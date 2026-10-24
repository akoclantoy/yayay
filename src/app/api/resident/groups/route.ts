import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { deleteImage, deleteVideo, uploadImage, uploadVideo } from "@/lib/cloudinary";
import { db } from "@/lib/db";

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  memberIds: z.array(z.string().min(1)).min(3).max(50),
  theme: z.enum(["forest", "ocean", "sunset", "lavender", "midnight"]).default("forest"),
});
const messageSchema = z.object({
  action: z.enum(["message", "share_qr"]),
  groupId: z.string().min(1),
  content: z.string().trim().max(2000).optional(),
});
const updateSchema = z.object({
  action: z.enum(["read", "react", "settings", "add_members", "set_nickname", "edit_message", "delete_message"]),
  groupId: z.string().min(1),
  memberIds: z.array(z.string().min(1)).min(1).max(50).optional(),
  nickname: z.string().trim().max(32).optional(),
  messageId: z.string().min(1).optional(),
  content: z.string().trim().min(1).max(2000).optional(),
  reaction: z.enum(["LIKE", "HEART", "FUNNY", "ANGRY"]).optional(),
}).refine((input) =>
  (input.action !== "react" || Boolean(input.messageId && input.reaction)) &&
  (input.action !== "edit_message" || Boolean(input.messageId && input.content)) &&
  (input.action !== "delete_message" || Boolean(input.messageId)) &&
  (input.action !== "set_nickname" || input.nickname !== undefined),
);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_MEDIA_IMAGE_TYPES = new Set([...ALLOWED_IMAGE_TYPES, "image/gif"]);
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

function asDataUrl(file: File, bytes: Buffer) {
  return `data:${file.type};base64,${bytes.toString("base64")}`;
}

async function getMembership(groupId: string, userId: string) {
  return db.groupConversationMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { groupId: true, isAdmin: true },
  });
}

export async function GET(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;
  const userId = authResult.session.user.id;
  const groupId = new URL(request.url).searchParams.get("groupId");

  try {
    if (groupId) {
      const membership = await getMembership(groupId, userId);
      if (!membership) return NextResponse.json({ error: "Group not found" }, { status: 404 });
      const group = await db.groupConversation.findUnique({
        where: { id: groupId },
        select: {
          id: true,
          name: true,
          imageUrl: true,
          theme: true,
          themeImageUrl: true,
          createdById: true,
          members: {
            orderBy: { joinedAt: "asc" },
            select: {
              userId: true,
              nickname: true,
              isAdmin: true,
              lastReadAt: true,
              user: { select: { id: true, name: true, image: true, lastSeenAt: true } },
            },
          },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 250,
            select: {
              id: true,
              senderId: true,
              content: true,
              mediaUrl: true,
              mediaType: true,
              createdAt: true,
              reactions: {
                select: { userId: true, kind: true },
              },
            },
          },
        },
      });
      if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
      return NextResponse.json({ group: { ...group, messages: [...group.messages].reverse() } });
    }

    const groups = await db.groupConversation.findMany({
      where: { members: { some: { userId } } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        theme: true,
        themeImageUrl: true,
        updatedAt: true,
        members: {
          where: { userId },
          select: { lastReadAt: true },
        },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { senderId: true, content: true, mediaUrl: true, mediaType: true, createdAt: true },
        },
      },
    });
    return NextResponse.json({
      groups: groups.map((group) => {
        const lastMessage = group.messages[0] ?? null;
        const lastReadAt = group.members[0]?.lastReadAt ?? null;
        return {
          id: group.id,
          name: group.name,
          imageUrl: group.imageUrl,
          theme: group.theme,
          themeImageUrl: group.themeImageUrl,
          updatedAt: group.updatedAt,
          lastMessage,
          unread: Boolean(lastMessage && lastMessage.senderId !== userId &&
            (!lastReadAt || lastMessage.createdAt > lastReadAt)),
        };
      }),
    });
  } catch (error) {
    console.error("Failed to load resident group chats", error);
    return NextResponse.json({ error: "Unable to load group chats" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;
  const userId = authResult.session.user.id;
  let uploadedPublicId: string | undefined;
  let uploadedMediaType: string | null = null;
  let messageContent = "";

  try {
    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      const input = messageSchema.parse(await request.json());
      const membership = await getMembership(input.groupId, userId);
      if (!membership) return NextResponse.json({ error: "Group not found" }, { status: 404 });
      messageContent = input.content ?? "";
      if (input.action === "share_qr") {
        const profile = await db.residentProfile.findUnique({
          where: { userId },
          select: { qrCode: true },
        });
        if (!profile) return NextResponse.json({ error: "Resident profile not found" }, { status: 404 });
        messageContent = `ERGROUPQR:${profile.qrCode}`;
      } else if (!messageContent) {
        return NextResponse.json({ error: "Write a message or attach a photo or video." }, { status: 400 });
      } else if (messageContent.startsWith("ERGROUPQR:")) {
        return NextResponse.json({ error: "Use the QR sharing action to share a resident code" }, { status: 400 });
      }
      const message = await db.$transaction(async (tx) => {
        const created = await tx.groupMessage.create({
          data: {
            groupId: input.groupId,
            senderId: userId,
            content: messageContent,
          },
          select: {
            id: true,
            senderId: true,
            content: true,
            mediaUrl: true,
            mediaType: true,
            createdAt: true,
            reactions: { select: { userId: true, kind: true } },
          },
        });
        await tx.groupConversation.update({
          where: { id: input.groupId },
          data: { updatedAt: created.createdAt },
        });
        return created;
      });
      return NextResponse.json({ message }, { status: 201 });
    }

    const form = await request.formData();
    if (form.get("action") === "message") {
      const input = messageSchema.parse({
        action: form.get("action"),
        groupId: form.get("groupId"),
        content: form.get("content") || undefined,
      });
      if (input.action !== "message") {
        return NextResponse.json({ error: "Use JSON to share a group QR code" }, { status: 400 });
      }
      const fileValue = form.get("media");
      if (fileValue !== null && !(fileValue instanceof File)) {
        return NextResponse.json({ error: "Invalid media upload" }, { status: 400 });
      }
      const file = fileValue instanceof File ? fileValue : null;
      if (file && !(
        (ALLOWED_MEDIA_IMAGE_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_IMAGE_BYTES) ||
        (ALLOWED_VIDEO_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_VIDEO_BYTES)
      )) {
        return NextResponse.json({ error: "Choose an image up to 5 MB or a video up to 25 MB (MP4, WebM, or MOV)." }, { status: 400 });
      }
      if (!input.content && !file) {
        return NextResponse.json({ error: "Write a message or attach a photo or video." }, { status: 400 });
      }
      const membership = await getMembership(input.groupId, userId);
      if (!membership) return NextResponse.json({ error: "Group not found" }, { status: 404 });
      if (file) {
        const encoded = Buffer.from(await file.arrayBuffer()).toString("base64");
        const dataUrl = `data:${file.type};base64,${encoded}`;
        const uploaded = file.type.startsWith("video/")
          ? await uploadVideo(dataUrl, "resident-group-messages")
          : await uploadImage(dataUrl, "resident-group-messages");
        uploadedPublicId = uploaded.publicId;
        uploadedMediaType = file.type;
        const created = await db.groupMessage.create({
          data: {
            groupId: input.groupId,
            senderId: userId,
            content: input.content ?? "",
            mediaUrl: uploaded.url,
            mediaType: file.type,
            mediaPublicId: uploaded.publicId,
          },
          select: {
            id: true,
            senderId: true,
            content: true,
            mediaUrl: true,
            mediaType: true,
            createdAt: true,
            reactions: { select: { userId: true, kind: true } },
          },
        });
        await db.groupConversation.update({ where: { id: input.groupId }, data: { updatedAt: created.createdAt } });
        return NextResponse.json({ message: created }, { status: 201 });
      }
      const created = await db.groupMessage.create({
        data: { groupId: input.groupId, senderId: userId, content: input.content ?? "" },
        select: {
          id: true,
          senderId: true,
          content: true,
          mediaUrl: true,
          mediaType: true,
          createdAt: true,
          reactions: { select: { userId: true, kind: true } },
        },
      });
      await db.groupConversation.update({ where: { id: input.groupId }, data: { updatedAt: created.createdAt } });
      return NextResponse.json({ message: created }, { status: 201 });
    }
    const input = createSchema.parse({
      name: form.get("name"),
      memberIds: JSON.parse(String(form.get("memberIds") ?? "[]")),
      theme: form.get("theme") ?? "forest",
    });
    const memberIds = [...new Set(input.memberIds)];
    if (memberIds.length < 3) {
      return NextResponse.json({ error: "Invite at least three resident friends" }, { status: 400 });
    }
    const photo = form.get("photo");
    if (photo !== null && !(photo instanceof File)) {
      return NextResponse.json({ error: "Invalid group picture" }, { status: 400 });
    }
    if (photo instanceof File &&
      (!ALLOWED_IMAGE_TYPES.has(photo.type) || photo.size < 1 || photo.size > MAX_IMAGE_BYTES)) {
      return NextResponse.json({ error: "Choose a PNG, JPEG, or WebP picture up to 5 MB" }, { status: 400 });
    }

    const [friends, residents] = await Promise.all([
      db.friendship.findMany({
        where: {
          userLowId: userId,
          userHighId: { in: memberIds },
        },
        select: { userHighId: true },
      }).then(async (lowerMatches) => {
        const higherMatches = await db.friendship.findMany({
          where: { userHighId: userId, userLowId: { in: memberIds } },
          select: { userLowId: true },
        });
        return new Set([
          ...lowerMatches.map((friendship) => friendship.userHighId),
          ...higherMatches.map((friendship) => friendship.userLowId),
        ]);
      }),
      db.user.findMany({
        where: { id: { in: memberIds }, role: "RESIDENT", isActive: true },
        select: { id: true },
      }),
    ]);
    if (residents.length !== memberIds.length || friends.size !== memberIds.length) {
      return NextResponse.json({ error: "All invited members must be active resident friends" }, { status: 403 });
    }

    let imageUrl: string | undefined;
    if (photo instanceof File) {
      const uploaded = await uploadImage(
        asDataUrl(photo, Buffer.from(await photo.arrayBuffer())),
        "resident-group-chats",
      );
      imageUrl = uploaded.url;
      uploadedPublicId = uploaded.publicId;
    }

    const group = await db.$transaction(async (tx) => {
      const created = await tx.groupConversation.create({
        data: {
          name: input.name,
          theme: input.theme,
          imageUrl,
          imagePublicId: uploadedPublicId,
          createdById: userId,
          members: {
            create: [
              { userId, isAdmin: true },
              ...memberIds.map((memberId) => ({ userId: memberId })),
            ],
          },
        },
        select: { id: true, name: true, imageUrl: true, theme: true },
      });
      return created;
    });
    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    if (uploadedPublicId) {
      try {
        if (uploadedMediaType?.startsWith("video/")) {
          await deleteVideo(uploadedPublicId);
        } else {
          await deleteImage(uploadedPublicId);
        }
      } catch (cleanupError) {
        console.error("Failed to clean up an unused group image", cleanupError);
      }
    }
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Enter a group name and invite at least three friends" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Cloudinary is not configured") {
      return NextResponse.json({ error: "Photo and video messaging requires Cloudinary configuration." }, { status: 503 });
    }
    console.error("Failed to create resident group chat", error);
    return NextResponse.json({ error: "Unable to create group chat" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;
  const userId = authResult.session.user.id;
  let newImagePublicId: string | undefined;
  let newThemeImagePublicId: string | undefined;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const groupId = z.string().min(1).parse(form.get("groupId"));
      const name = z.string().trim().min(2).max(60).parse(form.get("name"));
      const theme = z.enum(["forest", "ocean", "sunset", "lavender", "midnight"])
        .parse(form.get("theme"));
      const photo = form.get("photo");
      const themePhoto = form.get("themePhoto");
      if (photo !== null && !(photo instanceof File)) {
        return NextResponse.json({ error: "Invalid group picture" }, { status: 400 });
      }
      if (themePhoto !== null && !(themePhoto instanceof File)) {
        return NextResponse.json({ error: "Invalid theme picture" }, { status: 400 });
      }
      if (photo instanceof File &&
        (!ALLOWED_IMAGE_TYPES.has(photo.type) || photo.size < 1 || photo.size > MAX_IMAGE_BYTES)) {
        return NextResponse.json({ error: "Choose a PNG, JPEG, or WebP picture up to 5 MB" }, { status: 400 });
      }
      if (themePhoto instanceof File &&
        (!ALLOWED_IMAGE_TYPES.has(themePhoto.type) || themePhoto.size < 1 || themePhoto.size > MAX_IMAGE_BYTES)) {
        return NextResponse.json({ error: "Choose a PNG, JPEG, or WebP theme picture up to 5 MB" }, { status: 400 });
      }
      const membership = await getMembership(groupId, userId);
      if (!membership?.isAdmin) return NextResponse.json({ error: "Only group admins can edit settings" }, { status: 403 });

      let imageUrl: string | undefined;
      let themeImageUrl: string | undefined;
      if (photo instanceof File) {
        const uploaded = await uploadImage(
          asDataUrl(photo, Buffer.from(await photo.arrayBuffer())),
          "resident-group-chats",
        );
        imageUrl = uploaded.url;
        newImagePublicId = uploaded.publicId;
      }
      if (themePhoto instanceof File) {
        const uploaded = await uploadImage(
          asDataUrl(themePhoto, Buffer.from(await themePhoto.arrayBuffer())),
          "resident-group-chats",
        );
        themeImageUrl = uploaded.url;
        newThemeImagePublicId = uploaded.publicId;
      }
      const oldImage = await db.groupConversation.findUnique({
        where: { id: groupId },
        select: { imagePublicId: true, themeImagePublicId: true },
      });
      const group = await db.groupConversation.update({
        where: { id: groupId },
        data: {
          name,
          theme,
          ...(imageUrl ? { imageUrl, imagePublicId: newImagePublicId } : {}),
          ...(themeImageUrl ? { themeImageUrl, themeImagePublicId: newThemeImagePublicId } : {}),
        },
        select: { id: true, name: true, imageUrl: true, theme: true, themeImageUrl: true },
      });
      if (newImagePublicId && oldImage?.imagePublicId) {
        await deleteImage(oldImage.imagePublicId).catch((error: unknown) => {
          console.error("Failed to remove the previous group picture", error);
        });
      }
      if (newThemeImagePublicId && oldImage?.themeImagePublicId) {
        await deleteImage(oldImage.themeImagePublicId).catch((error: unknown) => {
          console.error("Failed to remove the previous group theme picture", error);
        });
      }
      return NextResponse.json({ group });
    }

    const input = updateSchema.parse(await request.json());
    const membership = await getMembership(input.groupId, userId);
    if (!membership) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    if (input.action === "edit_message" || input.action === "delete_message") {
      const message = await db.groupMessage.findFirst({
        where: { id: input.messageId, groupId: input.groupId, deletedAt: null },
        select: {
          id: true,
          senderId: true,
          content: true,
          mediaUrl: true,
          mediaType: true,
          mediaPublicId: true,
        },
      });
      if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
      if (message.senderId !== userId) {
        return NextResponse.json({ error: "Only your own messages can be changed" }, { status: 403 });
      }
      if (input.action === "edit_message") {
        const content = input.content?.trim();
        if (message.content.startsWith("ERGROUPQR:")) {
          return NextResponse.json({ error: "Shared QR codes cannot be edited" }, { status: 403 });
        }
        if (message.mediaUrl) {
          return NextResponse.json({ error: "Messages with attachments cannot be edited" }, { status: 400 });
        }
        if (!content || content.startsWith("ERGROUPQR:")) {
          return NextResponse.json({ error: "Enter a valid message" }, { status: 400 });
        }
        const updated = await db.$transaction(async (tx) => {
          const updatedMessage = await tx.groupMessage.update({
            where: { id: message.id },
            data: { content },
            select: {
              id: true,
              senderId: true,
              content: true,
              mediaUrl: true,
              mediaType: true,
              createdAt: true,
              reactions: { select: { userId: true, kind: true } },
            },
          });
          await tx.groupConversation.update({
            where: { id: input.groupId },
            data: { updatedAt: new Date() },
          });
          return updatedMessage;
        });
        return NextResponse.json({ message: updated });
      }

      await db.$transaction(async (tx) => {
        await tx.groupMessageReaction.deleteMany({ where: { messageId: message.id } });
        await tx.groupMessage.update({
          where: { id: message.id },
          data: { deletedAt: new Date() },
        });
        await tx.groupConversation.update({
          where: { id: input.groupId },
          data: { updatedAt: new Date() },
        });
      });
      if (message.mediaPublicId) {
        try {
          if (message.mediaType?.startsWith("video/")) {
            await deleteVideo(message.mediaPublicId);
          } else {
            await deleteImage(message.mediaPublicId);
          }
        } catch (cleanupError) {
          console.error("Failed to remove a deleted group message attachment", cleanupError);
        }
      }
      return NextResponse.json({ success: true });
    }

    if (input.action === "set_nickname") {
      const member = await db.groupConversationMember.update({
        where: { groupId_userId: { groupId: input.groupId, userId } },
        data: { nickname: input.nickname?.trim() || null },
        select: { userId: true, nickname: true },
      });
      return NextResponse.json({ member });
    }

    if (input.action === "add_members") {
      if (!membership.isAdmin) return NextResponse.json({ error: "Only group admins can add members" }, { status: 403 });
      const memberIds = [...new Set(input.memberIds ?? [])].filter((memberId) => memberId !== userId);
      if (!memberIds.length) return NextResponse.json({ error: "Choose at least one friend to add" }, { status: 400 });
      const existing = await db.groupConversationMember.findMany({
        where: { groupId: input.groupId, userId: { in: memberIds } },
        select: { userId: true },
      });
      const existingIds = new Set(existing.map((member) => member.userId));
      const newMemberIds = memberIds.filter((memberId) => !existingIds.has(memberId));
      if (!newMemberIds.length) return NextResponse.json({ error: "Those residents are already group members" }, { status: 409 });
      const residents = await db.user.findMany({
        where: { id: { in: newMemberIds }, role: "RESIDENT", isActive: true },
        select: { id: true },
      });
      const [lowerMatches, higherMatches] = await Promise.all([
        db.friendship.findMany({
          where: { userLowId: userId, userHighId: { in: newMemberIds } },
          select: { userHighId: true },
        }),
        db.friendship.findMany({
          where: { userHighId: userId, userLowId: { in: newMemberIds } },
          select: { userLowId: true },
        }),
      ]);
      const friendIds = new Set([
        ...lowerMatches.map((friendship) => friendship.userHighId),
        ...higherMatches.map((friendship) => friendship.userLowId),
      ]);
      if (residents.length !== newMemberIds.length || friendIds.size !== newMemberIds.length) {
        return NextResponse.json({ error: "Only active resident friends can be added" }, { status: 403 });
      }
      await db.groupConversationMember.createMany({
        data: newMemberIds.map((memberId) => ({ groupId: input.groupId, userId: memberId })),
        skipDuplicates: true,
      });
      const members = await db.groupConversationMember.findMany({
        where: { groupId: input.groupId },
        orderBy: { joinedAt: "asc" },
        select: {
          userId: true,
          nickname: true,
          isAdmin: true,
          lastReadAt: true,
          user: { select: { id: true, name: true, image: true, lastSeenAt: true } },
        },
      });
      return NextResponse.json({ members });
    }

    if (input.action === "read") {
      const readAt = new Date();
      await db.groupConversationMember.update({
        where: { groupId_userId: { groupId: input.groupId, userId } },
        data: { lastReadAt: readAt },
      });
      return NextResponse.json({ readAt });
    }

    if (input.action === "react") {
      const message = await db.groupMessage.findFirst({
        where: { id: input.messageId, groupId: input.groupId, deletedAt: null },
        select: { id: true },
      });
      if (!message || !input.reaction) {
        return NextResponse.json({ error: "Message not found" }, { status: 404 });
      }
      const existing = await db.groupMessageReaction.findUnique({
        where: { messageId_userId: { messageId: message.id, userId } },
        select: { id: true, kind: true },
      });
      await db.groupMessageReaction.upsert({
        where: { messageId_userId: { messageId: message.id, userId } },
        create: { messageId: message.id, userId, kind: input.reaction },
        update: { kind: input.reaction, createdAt: new Date() },
      });
      if (existing?.kind === input.reaction) {
        await db.groupMessageReaction.delete({ where: { id: existing.id } });
      }
      const reactions = await db.groupMessageReaction.findMany({
        where: { messageId: message.id },
        select: { userId: true, kind: true },
      });
      return NextResponse.json({ reactions });
    }
    return NextResponse.json({ error: "Invalid group action" }, { status: 400 });
  } catch (error) {
    if (newImagePublicId) {
      try {
        await deleteImage(newImagePublicId);
      } catch (cleanupError) {
        console.error("Failed to clean up an unused group image", cleanupError);
      }
    }
    if (newThemeImagePublicId) {
      try {
        await deleteImage(newThemeImagePublicId);
      } catch (cleanupError) {
        console.error("Failed to clean up an unused group theme picture", cleanupError);
      }
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Cloudinary is not configured") {
      return NextResponse.json({ error: "Custom group pictures require Cloudinary configuration." }, { status: 503 });
    }
    console.error("Failed to update resident group chat", error);
    return NextResponse.json({ error: "Unable to update group chat" }, { status: 500 });
  }
}
