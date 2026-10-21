import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import {
  canonicalDirectConversationPair,
  canonicalFriendshipPair,
  getSharedResidentQrCode,
} from "@/lib/resident-social";

const forwardSchema = z.object({
  sourceType: z.enum(["direct", "group"]),
  messageId: z.string().min(1),
  destinationType: z.enum(["direct", "group"]),
  friendId: z.string().min(1).optional(),
  groupId: z.string().min(1).optional(),
}).refine((input) => input.destinationType === "direct"
  ? Boolean(input.friendId)
  : Boolean(input.groupId));

export async function POST(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;
  const userId = authResult.session.user.id;

  try {
    const input = forwardSchema.parse(await request.json());
    let source: { content: string; mediaUrl: string | null; mediaType: string | null } | null = null;

    if (input.sourceType === "direct") {
      const message = await db.directMessage.findFirst({
        where: {
          id: input.messageId,
          deletedAt: null,
          systemMessage: false,
          conversation: {
            OR: [
              { participantLowId: userId, hiddenAtLow: null },
              { participantHighId: userId, hiddenAtHigh: null },
            ],
          },
        },
        select: {
          content: true,
          mediaUrl: true,
          mediaType: true,
          conversation: { select: { participantLowId: true, participantHighId: true } },
        },
      });
      if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
      const friendId = message.conversation.participantLowId === userId
        ? message.conversation.participantHighId
        : message.conversation.participantLowId;
      const friendship = await db.friendship.findUnique({
        where: { userLowId_userHighId: canonicalFriendshipPair(userId, friendId) },
        select: { id: true },
      });
      if (!friendship) return NextResponse.json({ error: "You can forward messages from friends only" }, { status: 403 });
      if (getSharedResidentQrCode(message.content)) {
        return NextResponse.json({ error: "Resident QR codes cannot be forwarded" }, { status: 403 });
      }
      source = message;
    } else {
      const message = await db.groupMessage.findFirst({
        where: {
          id: input.messageId,
          deletedAt: null,
          group: { members: { some: { userId } } },
        },
        select: { content: true, mediaUrl: true, mediaType: true },
      });
      if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
      source = message;
    }

    if (input.destinationType === "direct") {
      const friendId = input.friendId!;
      if (friendId === userId) return NextResponse.json({ error: "You cannot forward a message to yourself" }, { status: 400 });
      const [friendship, target, block] = await Promise.all([
        db.friendship.findUnique({
          where: { userLowId_userHighId: canonicalFriendshipPair(userId, friendId) },
          select: { id: true },
        }),
        db.user.findFirst({
          where: { id: friendId, role: "RESIDENT", isActive: true },
          select: { id: true },
        }),
        db.residentBlock.findFirst({
          where: {
            OR: [
              { blockerId: userId, blockedId: friendId },
              { blockerId: friendId, blockedId: userId },
            ],
          },
          select: { id: true },
        }),
      ]);
      if (!friendship || !target || block) {
        return NextResponse.json({ error: "Messages can only be forwarded to active friends" }, { status: 403 });
      }
      const pair = canonicalDirectConversationPair(userId, friendId);
      const result = await db.$transaction(async (tx) => {
        const conversation = await tx.directConversation.upsert({
          where: { participantLowId_participantHighId: pair },
          create: pair,
          update: { hiddenAtLow: null, hiddenAtHigh: null },
        });
        const message = await tx.directMessage.create({
          data: {
            conversationId: conversation.id,
            senderId: userId,
            content: source.content,
            mediaUrl: source.mediaUrl,
            mediaType: source.mediaType,
          },
          select: { id: true, content: true, mediaUrl: true, mediaType: true, createdAt: true },
        });
        await tx.directConversation.update({ where: { id: conversation.id }, data: { updatedAt: message.createdAt } });
        return { conversation, message };
      });
      return NextResponse.json(result, { status: 201 });
    }

    const groupId = input.groupId!;
    const membership = await db.groupConversationMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { groupId: true },
    });
    if (!membership) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    const message = await db.$transaction(async (tx) => {
      const created = await tx.groupMessage.create({
        data: {
          groupId,
          senderId: userId,
          content: source.content,
          mediaUrl: source.mediaUrl,
          mediaType: source.mediaType,
        },
        select: { id: true, content: true, mediaUrl: true, mediaType: true, createdAt: true },
      });
      await tx.groupConversation.update({ where: { id: groupId }, data: { updatedAt: created.createdAt } });
      return created;
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("Failed to forward resident message", error);
    return NextResponse.json({ error: "Unable to forward message" }, { status: 500 });
  }
}
