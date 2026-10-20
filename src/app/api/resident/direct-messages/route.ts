import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import {
  canonicalDirectConversationPair,
  canonicalFriendshipPair,
  hasUnreadMessage,
} from "@/lib/resident-social";

const messageSchema = z.object({
  friendId: z.string().min(1),
  content: z.string().trim().min(1).max(2000),
});

const actionSchema = z.object({
  conversationId: z.string().min(1).optional(),
  friendId: z.string().min(1).optional(),
  action: z.enum(["read", "delete", "unfriend", "block"]),
}).refine((value) => value.conversationId || value.friendId);

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
            select: { id: true, name: true, image: true, isActive: true },
          },
          participantHigh: {
            select: { id: true, name: true, image: true, isActive: true },
          },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
            take: 200,
            select: {
              id: true,
              senderId: true,
              content: true,
              createdAt: true,
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
      return NextResponse.json({
        conversation: {
          id: conversation.id,
          theme: conversation.theme,
          backgroundImageUrl: conversation.backgroundImageUrl,
          friend: { id: friend.id, name: friend.name, image: friend.image },
          messages: conversation.messages,
          readAt: conversation.participantLowId === userId
            ? conversation.lastReadAtLow
            : conversation.lastReadAtHigh,
        },
      });
    }

    const [friendships, conversations, blocks] = await Promise.all([
      db.friendship.findMany({
        where: { OR: [{ userLowId: userId }, { userHighId: userId }] },
        include: {
          userLow: { select: { id: true, name: true, image: true, isActive: true } },
          userHigh: { select: { id: true, name: true, image: true, isActive: true } },
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
        participantLow: { select: { id: true, name: true, image: true, isActive: true } },
        participantHigh: { select: { id: true, name: true, image: true, isActive: true } },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, createdAt: true, senderId: true },
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
        friend: { id: friend.id, name: friend.name, image: friend.image },
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
    const { conversationId, friendId: requestedFriendId, action } = actionSchema.parse(await request.json());
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

  try {
    const { friendId, content } = messageSchema.parse(await request.json());
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
        data: { conversationId: conversation.id, senderId: userId, content },
        select: { id: true, senderId: true, content: true, createdAt: true },
      });
      await tx.directConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });
      return { conversation, message };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("Failed to send resident direct message", error);
    return NextResponse.json({ error: "Unable to send message" }, { status: 500 });
  }
}
