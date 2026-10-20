import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import {
  canonicalDirectConversationPair,
  canonicalFriendshipPair,
} from "@/lib/resident-social";

const transferSchema = z.object({
  recipientQrCode: z.string().trim().min(1).max(200),
  amount: z.number().int().positive().max(10_000),
});

export async function GET() {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;

  try {
    const profile = await db.residentProfile.findUnique({
      where: { userId: authResult.session.user.id },
      select: {
        qrCode: true,
        wallet: { select: { balance: true } },
      },
    });
    if (!profile) return NextResponse.json({ error: "Resident profile not found" }, { status: 404 });
    return NextResponse.json({ qrCode: profile.qrCode, balance: profile.wallet?.balance ?? 0 });
  } catch (error) {
    console.error("Failed to load resident transfer details", error);
    return NextResponse.json({ error: "Unable to load transfer details" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;
  const senderId = authResult.session.user.id;

  try {
    const { recipientQrCode, amount } = transferSchema.parse(await request.json());
    const recipientProfile = await db.residentProfile.findUnique({
      where: { qrCode: recipientQrCode },
      select: {
        userId: true,
        user: { select: { name: true, isActive: true, role: true } },
      },
    });
    if (!recipientProfile || !recipientProfile.user.isActive || recipientProfile.user.role !== "RESIDENT") {
      return NextResponse.json({ error: "Resident not found" }, { status: 404 });
    }
    const recipientId = recipientProfile.userId;
    if (recipientId === senderId) {
      return NextResponse.json({ error: "You cannot transfer points to yourself" }, { status: 400 });
    }

    const pair = canonicalFriendshipPair(senderId, recipientId);
    if (!(await db.friendship.findUnique({ where: { userLowId_userHighId: pair } }))) {
      return NextResponse.json({ error: "You can transfer points to friends only" }, { status: 403 });
    }

    const transfer = await db.$transaction(async (tx) => {
      const senderWallet = await tx.rewardWallet.findUnique({ where: { residentId: senderId } });
      if (!senderWallet) throw new Error("SENDER_WALLET_NOT_FOUND");
      if (senderWallet.balance < amount) throw new Error("INSUFFICIENT_POINTS");

      const debit = await tx.rewardWallet.updateMany({
        where: { residentId: senderId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (!debit.count) throw new Error("INSUFFICIENT_POINTS");

      const recipientWallet = await tx.rewardWallet.upsert({
        where: { residentId: recipientId },
        create: { residentId: recipientId, balance: amount },
        update: { balance: { increment: amount } },
      });
      const updatedSender = await tx.rewardWallet.findUniqueOrThrow({
        where: { residentId: senderId },
      });
      const pointTransfer = await tx.pointTransfer.create({
        data: { senderId, recipientId, amount },
      });
      const conversationPair = canonicalDirectConversationPair(senderId, recipientId);
      const conversation = await tx.directConversation.upsert({
        where: {
          participantLowId_participantHighId: conversationPair,
        },
        create: conversationPair,
        update: { hiddenAtLow: null, hiddenAtHigh: null },
      });
      const senderName = authResult.session.user.name?.trim() || "EcoRewards resident";
      const recipientName = recipientProfile.user.name?.trim() || "EcoRewards resident";
      await tx.directMessage.create({
        data: {
          conversationId: conversation.id,
          senderId,
          systemMessage: true,
          content: [
            "Points transfer completed",
            `From: ${senderName}`,
            `To: ${recipientName}`,
            `Amount: ${amount.toLocaleString("en-US")} points`,
            `Completed: ${pointTransfer.createdAt.toISOString()}`,
            `Transfer reference: ${pointTransfer.id}`,
          ].join("\n"),
        },
      });
      await tx.directConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: pointTransfer.createdAt },
      });
      await tx.rewardTransaction.createMany({
        data: [
          {
            walletId: updatedSender.id,
            userId: senderId,
            type: "TRANSFER",
            amount: -amount,
            balanceAfter: updatedSender.balance,
            description: `Points sent to ${recipientProfile.user.name ?? "resident"}`,
            referenceId: pointTransfer.id,
          },
          {
            walletId: recipientWallet.id,
            userId: recipientId,
            type: "TRANSFER",
            amount,
            balanceAfter: recipientWallet.balance,
            description: `Points received from ${authResult.session.user.name ?? "resident"}`,
            referenceId: pointTransfer.id,
          },
        ],
      });
      await tx.notification.create({
        data: {
          userId: recipientId,
          title: "Points received",
          message: `${senderName} sent you ${amount.toLocaleString("en-US")} points. Reference: ${pointTransfer.id}`,
          type: "points_transfer",
          link: "/resident/rewards",
        },
      });
      return {
        id: pointTransfer.id,
        balance: updatedSender.balance,
        conversationId: conversation.id,
      };
    });

    return NextResponse.json({
      success: true,
      transferId: transfer.id,
      amount,
      balance: transfer.balance,
      conversationId: transfer.conversationId,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    if (error instanceof Error && error.message === "INSUFFICIENT_POINTS") {
      return NextResponse.json({ error: "Not enough points for this transfer" }, { status: 409 });
    }
    if (error instanceof Error && error.message === "SENDER_WALLET_NOT_FOUND") {
      return NextResponse.json({ error: "Your points wallet was not found" }, { status: 404 });
    }
    console.error("Failed to transfer resident points", error);
    return NextResponse.json({ error: "Unable to transfer points" }, { status: 500 });
  }
}
