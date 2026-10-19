import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { deleteImage, uploadImage } from "@/lib/cloudinary";
import { deliverDuePickupReminders } from "@/lib/pickup-reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const messageSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().trim().max(5000).optional(),
});
const editSchema = z.object({
  messageId: z.string().min(1),
  content: z.string().trim().min(1).max(5000),
});
const removeSchema = z.object({ messageId: z.string().min(1) });

async function findConversationForUser(
  conversationId: string,
  userId: string,
  role: string
) {
  const where =
    role === "RESIDENT"
      ? { id: conversationId, residentId: userId, pickup: { is: { deletedAt: null } } }
      : role === "ADMIN"
        ? { id: conversationId, pickup: { is: { deletedAt: null } } }
        : {
            id: conversationId,
            pickup: { is: { deletedAt: null } },
            OR: [{ staffId: userId }, { pickup: { is: { assignedStaffId: userId } } }],
          };

  return db.conversation.findFirst({
    where,
    include: {
      pickup: {
        select: {
          id: true,
          userId: true,
          assignedStaffId: true,
          address: true,
          status: true,
        },
      },
    },
  });
}

export async function GET(request: Request) {
  const authResult = await requireRole(["RESIDENT", "COLLECTION_STAFF", "BARANGAY_STAFF", "ADMIN"]);
  if ("error" in authResult) return authResult.error;
  const { id: userId, role } = authResult.session.user;

  await deliverDuePickupReminders();
  const conversationId = new URL(request.url).searchParams.get("conversationId");
  if (conversationId) {
    const conversation = await findConversationForUser(conversationId, userId, role);
    if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    const messages = await db.conversationMessage.findMany({
      where: { conversationId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      take: 500,
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
    return NextResponse.json({ conversation, messages });
  }

  const participantFilter =
    role === "RESIDENT"
      ? { residentId: userId }
      : role === "ADMIN"
        ? {}
        : {
            OR: [
              { staffId: userId },
              { pickup: { is: { assignedStaffId: userId } } },
            ],
          };
  const conversations = await db.conversation.findMany({
    where: { ...participantFilter, pickup: { is: { deletedAt: null } } },
    orderBy: { updatedAt: "desc" },
    include: {
      pickup: {
        select: {
          id: true,
          address: true,
          status: true,
          scheduledDate: true,
          user: { select: { id: true, name: true } },
          assignedStaff: { select: { id: true, name: true } },
        },
      },
      resident: { select: { id: true, name: true } },
      staff: { select: { id: true, name: true } },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, imageUrl: true, createdAt: true },
      },
    },
  });
  return NextResponse.json(conversations);
}

export async function POST(request: Request) {
  const authResult = await requireRole(["RESIDENT", "COLLECTION_STAFF", "BARANGAY_STAFF", "ADMIN"]);
  if ("error" in authResult) return authResult.error;
  const { id: userId, role } = authResult.session.user;

  let uploaded: { url: string; publicId: string } | null = null;
  try {
    const form = await request.formData();
    const parsed = messageSchema.safeParse({
      conversationId: form.get("conversationId"),
      content: form.get("content") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const file = form.get("image");
    if (file !== null && !(file instanceof File)) {
      return NextResponse.json({ error: "Invalid image upload." }, { status: 400 });
    }
    if (file instanceof File) {
      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
        return NextResponse.json({ error: "Upload a JPG, PNG, WEBP, or GIF image." }, { status: 400 });
      }
      if (file.size === 0 || file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "Images must be between 1 byte and 5 MB." }, { status: 400 });
      }
    }
    const content = parsed.data.content?.trim() || null;
    if (!content && !(file instanceof File)) {
      return NextResponse.json({ error: "Write a message or attach an image." }, { status: 400 });
    }

    const conversation = await findConversationForUser(
      parsed.data.conversationId,
      userId,
      role
    );
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (file instanceof File) {
      const encoded = Buffer.from(await file.arrayBuffer()).toString("base64");
      uploaded = await uploadImage(
        `data:${file.type};base64,${encoded}`,
        "pickup-messages"
      );
    }

    const recipientId =
      userId === conversation.residentId
        ? conversation.staffId ?? conversation.pickup.assignedStaffId
        : conversation.residentId;
    const saved = await db.$transaction(async (tx) => {
      const message = await tx.conversationMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: userId,
          content,
          imageUrl: uploaded?.url,
          imagePublicId: uploaded?.publicId,
        },
        include: { sender: { select: { id: true, name: true, role: true } } },
      });
      await tx.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });
      if (recipientId) {
        await tx.notification.create({
          data: {
            userId: recipientId,
            title: "New pickup message",
            message: content?.slice(0, 160) ?? "You received a pickup photo.",
            type: "pickup",
            link: role === "RESIDENT" ? "/staff/messages" : "/resident/messages",
          },
        });
      }
      return message;
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    if (uploaded) {
      try {
        await deleteImage(uploaded.publicId);
      } catch (cleanupError) {
        console.error("[messages] Failed to clean up an unused upload:", cleanupError);
      }
    }
    if (error instanceof Error && error.message === "Cloudinary is not configured") {
      return NextResponse.json({ error: "Image messaging requires Cloudinary configuration." }, { status: 503 });
    }
    console.error("[messages] Failed to send message:", error);
    return NextResponse.json({ error: "Failed to send message." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authResult = await requireRole(["RESIDENT", "COLLECTION_STAFF", "BARANGAY_STAFF", "ADMIN"]);
  if ("error" in authResult) return authResult.error;
  try {
    const parsed = editSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const message = await db.conversationMessage.findFirst({
      where: {
        id: parsed.data.messageId,
        senderId: authResult.session.user.id,
        deletedAt: null,
        systemMessage: false,
      },
      include: { conversation: { select: { id: true } } },
    });
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
    const accessible = await findConversationForUser(
      message.conversation.id,
      authResult.session.user.id,
      authResult.session.user.role
    );
    if (!accessible) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    const updated = await db.$transaction(async (tx) => {
      const updated = await tx.conversationMessage.update({
        where: { id: message.id },
        data: { content: parsed.data.content, editedAt: new Date() },
        include: { sender: { select: { id: true, name: true, role: true } } },
      });
      await tx.conversation.update({
        where: { id: message.conversation.id },
        data: { updatedAt: new Date() },
      });
      return updated;
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[messages] Failed to edit message:", error);
    return NextResponse.json({ error: "Failed to edit message." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authResult = await requireRole(["RESIDENT", "COLLECTION_STAFF", "BARANGAY_STAFF", "ADMIN"]);
  if ("error" in authResult) return authResult.error;
  let publicId: string | null = null;
  try {
    const parsed = removeSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const message = await db.conversationMessage.findFirst({
      where: {
        id: parsed.data.messageId,
        senderId: authResult.session.user.id,
        deletedAt: null,
        systemMessage: false,
      },
      include: { conversation: { select: { id: true } } },
    });
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
    const accessible = await findConversationForUser(
      message.conversation.id,
      authResult.session.user.id,
      authResult.session.user.role
    );
    if (!accessible) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    publicId = message.imagePublicId;
    await db.$transaction(async (tx) => {
      await tx.conversationMessage.update({
        where: { id: message.id },
        data: { deletedAt: new Date(), content: null, imageUrl: null, imagePublicId: null },
      });
      await tx.conversation.update({
        where: { id: message.conversation.id },
        data: { updatedAt: new Date() },
      });
    });
    if (publicId) {
      try {
        await deleteImage(publicId);
      } catch (error) {
        console.error("[messages] Failed to remove a deleted message image:", error);
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[messages] Failed to delete message:", error);
    return NextResponse.json({ error: "Failed to delete message." }, { status: 500 });
  }
}
