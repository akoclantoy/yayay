import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { deleteImage, deleteVideo, uploadImage, uploadVideo } from "@/lib/cloudinary";
import { db } from "@/lib/db";
import {
  canonicalDirectConversationPair,
  canonicalFriendshipPair,
  createResidentQrMessage,
  getSharedResidentQrCode,
  hasUnreadMessage,
} from "@/lib/resident-social";

const messageSchema = z.object({
  action: z.enum(["message", "share_qr"]).optional(),
  friendId: z.string().min(1),
  content: z.string().trim().min(1).max(2000).optional(),
});
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

const actionSchema = z.object({
  conversationId: z.string().min(1).optional(),
  friendId: z.string().min(1).optional(),
  messageId: z.string().min(1).optional(),
  content: z.string().trim().min(1).max(2000).optional(),
  reaction: z.enum(["LIKE", "HEART", "FUNNY", "ANGRY"]).optional(),
  action: z.enum([
    "read",
    "delete",
    "unfriend",
    "block",
    "edit_message",
    "delete_message",
    "react",
  ]),
}).refine((value) => {
  if (["edit_message", "delete_message", "react"].includes(value.action)) {
    return Boolean(
      value.messageId &&
      (value.action !== "edit_message" || value.content) &&
      (value.action !== "react" || value.reaction),
    );
  }
  return Boolean(value.conversationId || value.friendId);
});

async function isFriend(firstId: string, secondId: string) {
  const pair = canonicalFriendshipPair(firstId, secondId);
  return db.friendship.findUnique({ where: { userLowId_userHighId: pair } });
}

export async function GET(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;
  const userId = authResult.session.user.id;
  const conversationId = new URL(request.url).searchParams.get("conversationId");

  try {
    if (conversationId) {
      const conversation = await db.directConversation.findFirst({
        where: {
          id: conversationId,
          OR: [
            { participantLowId: userId, hiddenAtLow: null },
            { participantHighId: userId, hiddenAtHigh: null },
          ],
        },
        select: {
          id: true,
          participantLowId: true,
          participantHighId: true,
          theme: true,
          backgroundImageUrl: true,
          lastReadAtLow: true,
          lastReadAtHigh: true,
          participantLow: {
            select: { id: true, name: true, image: true, isActive: true, lastSeenAt: true },
          },
          participantHigh: {
            select: { id: true, name: true, image: true, isActive: true, lastSeenAt: true },
          },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
            take: 200,
            select: {
              id: true,
              senderId: true,
              content: true,
              systemMessage: true,
              mediaUrl: true,
              mediaType: true,
              editedAt: true,
              createdAt: true,
              reactions: { select: { userId: true, kind: true } },
            },
          },
        },
      });
      if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      const friendId = conversation.participantLowId === userId
        ? conversation.participantHighId
        : conversation.participantLowId;
      if (!(await isFriend(userId, friendId))) {
        return NextResponse.json({ error: "Messaging is available to friends only" }, { status: 403 });
      }
      const block = await db.residentBlock.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedId: friendId },
            { blockerId: friendId, blockedId: userId },
          ],
        },
        select: { id: true },
      });
      if (block) return NextResponse.json({ error: "Conversation is unavailable" }, { status: 404 });
      const friend = conversation.participantLowId === userId
        ? conversation.participantHigh
        : conversation.participantLow;
      if (!friend.isActive) return NextResponse.json({ error: "Resident unavailable" }, { status: 404 });
      const friendReadAt = conversation.participantLowId === userId
        ? conversation.lastReadAtHigh
        : conversation.lastReadAtLow;
      return NextResponse.json({
        conversation: {
          id: conversation.id,
          theme: conversation.theme,
          backgroundImageUrl: conversation.backgroundImageUrl,
          friend: {
            id: friend.id,
            name: friend.name,
            image: friend.image,
            online: Boolean(friend.lastSeenAt && Date.now() - friend.lastSeenAt.getTime() <= 60_000),
          },
          messages: conversation.messages,
          readAt: conversation.participantLowId === userId
            ? conversation.lastReadAtLow
            : conversation.lastReadAtHigh,
          friendReadAt,
        },
      });
    }

    const [friendships, conversations, blocks] = await Promise.all([
      db.friendship.findMany({
        where: { OR: [{ userLowId: userId }, { userHighId: userId }] },
        include: {
          userLow: { select: { id: true, name: true, image: true, isActive: true, lastSeenAt: true } },
          userHigh: { select: { id: true, name: true, image: true, isActive: true, lastSeenAt: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.directConversation.findMany({
      where: {
        OR: [
          { participantLowId: userId, hiddenAtLow: null },
          { participantHighId: userId, hiddenAtHigh: null },
        ],
      },
      select: {
        id: true,
        participantLowId: true,
        participantHighId: true,
        theme: true,
        backgroundImageUrl: true,
        lastReadAtLow: true,
        lastReadAtHigh: true,
        participantLow: { select: { id: true, name: true, image: true, isActive: true, lastSeenAt: true } },
        participantHigh: { select: { id: true, name: true, image: true, isActive: true, lastSeenAt: true } },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            content: true,
            mediaUrl: true,
            mediaType: true,
            createdAt: true,
            senderId: true,
            systemMessage: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      }),
      db.residentBlock.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        select: { blockerId: true, blockedId: true },
      }),
    ]);
    const blockedIds = new Set(blocks.map((block) =>
      block.blockerId === userId ? block.blockedId : block.blockerId,
    ));
    const conversationsByFriend = new Map(conversations.map((conversation) => {
      const lowParticipant = conversation.participantLowId === userId;
      const friendId = lowParticipant
        ? conversation.participantHighId
        : conversation.participantLowId;
      const friend = lowParticipant ? conversation.participantHigh : conversation.participantLow;
      const lastMessage = conversation.messages[0] ?? null;
      const lastReadAt = lowParticipant ? conversation.lastReadAtLow : conversation.lastReadAtHigh;
      return [friendId, {
        id: conversation.id,
        theme: conversation.theme,
        backgroundImageUrl: conversation.backgroundImageUrl,
        friend: {
          id: friend.id,
          name: friend.name,
          image: friend.image,
          online: Boolean(friend.lastSeenAt && Date.now() - friend.lastSeenAt.getTime() <= 60_000),
        },
        lastMessage,
        unread: Boolean(lastMessage && hasUnreadMessage({
          senderId: lastMessage.senderId,
          residentId: userId,
          messageCreatedAt: lastMessage.createdAt,
          readAt: lastReadAt,
        })),
      }] as const;
    }));
    const visibleConversations = friendships.flatMap((friendship) => {
      const friend = friendship.userLowId === userId ? friendship.userHigh : friendship.userLow;
      const conversation = conversationsByFriend.get(friend.id);
      return friend.isActive && !blockedIds.has(friend.id)
        ? [conversation ?? {
            id: null,
            theme: "forest",
            backgroundImageUrl: null,
            friend: { id: friend.id, name: friend.name, image: friend.image },
            lastMessage: null,
            unread: false,
          }]
        : [];
    });
    visibleConversations.sort((first, second) => {
      if (!first.lastMessage) return second.lastMessage ? 1 : first.friend.name?.localeCompare(second.friend.name ?? "") ?? 0;
      if (!second.lastMessage) return -1;
      return second.lastMessage.createdAt.getTime() - first.lastMessage.createdAt.getTime();
    });
    return NextResponse.json({ conversations: visibleConversations });
  } catch (error) {
    console.error("Failed to load resident direct messages", error);
    return NextResponse.json({ error: "Unable to load messages" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;
  const userId = authResult.session.user.id;

  try {
    const {
      conversationId,
      friendId: requestedFriendId,
      messageId,
      content,
      reaction,
      action,
    } = actionSchema.parse(await request.json());

    if (["edit_message", "delete_message", "react"].includes(action)) {
      if (!messageId) {
        return NextResponse.json({ error: "Message is required" }, { status: 400 });
      }
      const message = await db.directMessage.findFirst({
        where: {
          id: messageId,
          deletedAt: null,
          conversation: {
            OR: [
              { participantLowId: userId, hiddenAtLow: null },
              { participantHighId: userId, hiddenAtHigh: null },
            ],
          },
        },
        select: {
          id: true,
          senderId: true,
          content: true,
          systemMessage: true,
          conversation: {
            select: {
              id: true,
              participantLowId: true,
              participantHighId: true,
            },
          },
        },
      });
      if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
      const friendId = message.conversation.participantLowId === userId
        ? message.conversation.participantHighId
        : message.conversation.participantLowId;
      if (!(await isFriend(userId, friendId))) {
        return NextResponse.json({ error: "Messaging is available to friends only" }, { status: 403 });
      }
      const block = await db.residentBlock.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedId: friendId },
            { blockerId: friendId, blockedId: userId },
          ],
        },
        select: { id: true },
      });
      if (block) return NextResponse.json({ error: "Conversation is unavailable" }, { status: 404 });

      if (action === "edit_message" || action === "delete_message") {
        if (message.senderId !== userId || message.systemMessage) {
          return NextResponse.json({ error: "Only your own messages can be changed" }, { status: 403 });
        }
        if (action === "edit_message") {
          if (getSharedResidentQrCode(message.content) !== null) {
            return NextResponse.json({ error: "Shared QR codes cannot be edited" }, { status: 403 });
          }
          if (!content) return NextResponse.json({ error: "Message content is required" }, { status: 400 });
          if (getSharedResidentQrCode(content) !== null) {
            return NextResponse.json({ error: "Use the QR sharing action to share a resident code" }, { status: 400 });
          }
          const updated = await db.$transaction(async (tx) => {
            const updatedMessage = await tx.directMessage.update({
              where: { id: message.id },
              data: { content, editedAt: new Date() },
              select: {
                id: true,
                senderId: true,
                content: true,
                systemMessage: true,
                editedAt: true,
                createdAt: true,
                reactions: { select: { userId: true, kind: true } },
              },
            });
            await tx.directConversation.update({
              where: { id: message.conversation.id },
              data: { updatedAt: new Date() },
            });
            return updatedMessage;
          });
          return NextResponse.json(updated);
        }
        await db.$transaction(async (tx) => {
          await tx.directMessageReaction.deleteMany({
            where: { messageId: message.id },
          });
          await tx.directMessage.update({
            where: { id: message.id },
            data: { deletedAt: new Date() },
          });
          await tx.directConversation.update({
            where: { id: message.conversation.id },
            data: { updatedAt: new Date() },
          });
        });
        return NextResponse.json({ success: true });
      }

      if (!reaction) {
        return NextResponse.json({ error: "Reaction is required" }, { status: 400 });
      }
      const reactions = await db.$transaction(async (tx) => {
        const current = await tx.directMessageReaction.findUnique({
          where: {
            messageId_userId: {
              messageId: message.id,
              userId,
            },
          },
          select: { id: true, kind: true },
        });
        if (current?.kind === reaction) {
          await tx.directMessageReaction.delete({ where: { id: current.id } });
        } else {
          await tx.directMessageReaction.upsert({
            where: {
              messageId_userId: {
                messageId: message.id,
                userId,
              },
            },
            create: { messageId: message.id, userId, kind: reaction },
            update: { kind: reaction, createdAt: new Date() },
          });
        }
        return tx.directMessageReaction.findMany({
          where: { messageId: message.id },
          select: { userId: true, kind: true },
        });
      });
      return NextResponse.json({ success: true, reactions });
    }

    const conversation = conversationId
      ? await db.directConversation.findFirst({
          where: {
            id: conversationId,
            OR: [{ participantLowId: userId }, { participantHighId: userId }],
          },
          select: { id: true, participantLowId: true, participantHighId: true },
        })
      : null;
    if (conversationId && !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    if (!conversation && !requestedFriendId) {
      return NextResponse.json({ error: "Resident is required" }, { status: 400 });
    }
    let friendId: string;
    if (conversation) {
      friendId = conversation.participantLowId === userId
        ? conversation.participantHighId
        : conversation.participantLowId;
    } else if (requestedFriendId) {
      friendId = requestedFriendId;
    } else {
      return NextResponse.json({ error: "Resident is required" }, { status: 400 });
    }
    if (friendId === userId) return NextResponse.json({ error: "Invalid resident" }, { status: 400 });
    const target = await db.user.findFirst({
      where: { id: friendId, role: "RESIDENT", isActive: true },
      select: { id: true },
    });
    if (!target) return NextResponse.json({ error: "Resident unavailable" }, { status: 404 });
    const lowParticipant = conversation?.participantLowId === userId;

    if (action === "read") {
      if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      const readAt = new Date();
      await db.directConversation.update({
        where: { id: conversation.id },
        data: lowParticipant
          ? { lastReadAtLow: readAt }
          : { lastReadAtHigh: readAt },
      });
      return NextResponse.json({ success: true, readAt });
    }
    if (action === "delete") {
      if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      await db.directConversation.update({
        where: { id: conversation.id },
        data: lowParticipant
          ? { hiddenAtLow: new Date() }
          : { hiddenAtHigh: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    const pair = canonicalFriendshipPair(userId, friendId);
    if (action === "unfriend") {
      await db.friendship.deleteMany({ where: pair });
      return NextResponse.json({ success: true });
    }

    await db.$transaction(async (tx) => {
      await tx.residentBlock.upsert({
        where: { blockerId_blockedId: { blockerId: userId, blockedId: friendId } },
        create: { blockerId: userId, blockedId: friendId },
        update: {},
      });
      await tx.friendship.deleteMany({ where: pair });
      await tx.friendRequest.updateMany({
        where: {
          status: "PENDING",
          OR: [
            { senderId: userId, recipientId: friendId },
            { senderId: friendId, recipientId: userId },
          ],
        },
        data: { status: "CANCELLED" },
      });
      if (conversation) {
        await tx.directConversation.update({
          where: { id: conversation.id },
          data: lowParticipant
            ? { hiddenAtLow: new Date() }
            : { hiddenAtHigh: new Date() },
        });
      }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("Failed to update resident conversation", error);
    return NextResponse.json({ error: "Unable to update conversation" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;
  const userId = authResult.session.user.id;

  let uploaded: { url: string; publicId: string } | null = null;
  let uploadedMediaType: string | null = null;
  try {
    const isFormData = (request.headers.get("content-type") ?? "").includes("multipart/form-data");
    const form = isFormData ? await request.formData() : null;
    const fileValue = form?.get("media");
    if (fileValue !== null && fileValue !== undefined && !(fileValue instanceof File)) {
      return NextResponse.json({ error: "Invalid media upload" }, { status: 400 });
    }
    const file = fileValue instanceof File ? fileValue : null;
    const body = isFormData
      ? {
          action: "message" as const,
          friendId: String(form?.get("friendId") ?? ""),
          content: String(form?.get("content") ?? "").trim() || undefined,
        }
      : await request.json();
    const { action, friendId, content } = messageSchema.parse(body);
    if (file && !(
      (IMAGE_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_IMAGE_BYTES) ||
      (VIDEO_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_VIDEO_BYTES)
    )) {
      return NextResponse.json({ error: "Choose an image up to 5 MB or a video up to 25 MB (MP4, WebM, or MOV)." }, { status: 400 });
    }
    if (!content && !file && action !== "share_qr") {
      return NextResponse.json({ error: "Write a message or attach a photo or video." }, { status: 400 });
    }
    if (friendId === userId) return NextResponse.json({ error: "You cannot message yourself" }, { status: 400 });
    const friendship = await isFriend(userId, friendId);
    if (!friendship) return NextResponse.json({ error: "You can message friends only" }, { status: 403 });
    const block = await db.residentBlock.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: friendId },
          { blockerId: friendId, blockedId: userId },
        ],
      },
      select: { id: true },
    });
    if (block) return NextResponse.json({ error: "This conversation is unavailable" }, { status: 403 });

    const friend = await db.user.findFirst({
      where: { id: friendId, role: "RESIDENT", isActive: true },
      select: { id: true },
    });
    if (!friend) return NextResponse.json({ error: "Resident unavailable" }, { status: 404 });

    let messageContent = content;
    if (action === "share_qr") {
      const profile = await db.residentProfile.findUnique({
        where: { userId },
        select: { qrCode: true },
      });
      if (!profile) return NextResponse.json({ error: "Resident profile not found" }, { status: 404 });
      messageContent = createResidentQrMessage(profile.qrCode);
    }
    if (!messageContent) {
      if (!file) return NextResponse.json({ error: "Message content is required" }, { status: 400 });
      messageContent = "";
    }
    if (action !== "share_qr" && messageContent && getSharedResidentQrCode(messageContent) !== null) {
      return NextResponse.json({ error: "Use the QR sharing action to share a resident code" }, { status: 400 });
    }

    if (file) {
      const encoded = Buffer.from(await file.arrayBuffer()).toString("base64");
      const dataUrl = `data:${file.type};base64,${encoded}`;
      uploaded = file.type.startsWith("video/")
        ? await uploadVideo(dataUrl, "resident-direct-messages")
        : await uploadImage(dataUrl, "resident-direct-messages");
      uploadedMediaType = file.type;
    }
    const pair = canonicalDirectConversationPair(userId, friendId);
    const result = await db.$transaction(async (tx) => {
      const conversation = await tx.directConversation.upsert({
        where: {
          participantLowId_participantHighId: pair,
        },
        create: pair,
        update: { hiddenAtLow: null, hiddenAtHigh: null },
      });
      const message = await tx.directMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: userId,
          content: messageContent,
          mediaUrl: uploaded?.url,
          mediaType: file?.type,
          mediaPublicId: uploaded?.publicId,
        },
        select: {
          id: true,
          senderId: true,
          content: true,
          mediaUrl: true,
          mediaType: true,
          systemMessage: true,
          editedAt: true,
          createdAt: true,
          reactions: { select: { userId: true, kind: true } },
        },
      });
      await tx.directConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });
      return { conversation, message };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (uploaded) {
      try {
        if (uploadedMediaType?.startsWith("video/")) {
          await deleteVideo(uploaded.publicId);
        } else {
          await deleteImage(uploaded.publicId);
        }
      } catch (cleanupError) {
        console.error("Failed to clean up an unused direct message upload", cleanupError);
      }
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Cloudinary is not configured") {
      return NextResponse.json({ error: "Photo and video messaging requires Cloudinary configuration." }, { status: 503 });
    }
    console.error("Failed to send resident direct message", error);
    return NextResponse.json({ error: "Unable to send message" }, { status: 500 });
  }
}
