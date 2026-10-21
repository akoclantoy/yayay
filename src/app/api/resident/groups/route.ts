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
  action: z.literal("message"),
  groupId: z.string().min(1),
  content: z.string().trim().max(2000).optional(),
});
const updateSchema = z.object({
  action: z.enum(["read", "react", "settings"]),
  groupId: z.string().min(1),
  messageId: z.string().min(1).optional(),
  reaction: z.enum(["LIKE", "HEART", "FUNNY", "ANGRY"]).optional(),
}).refine((input) => input.action !== "react" || Boolean(input.messageId && input.reaction));

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
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
          createdById: true,
          members: {
            orderBy: { joinedAt: "asc" },
            select: {
              userId: true,
              isAdmin: true,
              lastReadAt: true,
              user: { select: { id: true, name: true, image: true, lastSeenAt: true } },
            },
          },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
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
      return NextResponse.json({ group });
    }

    const groups = await db.groupConversation.findMany({
      where: { members: { some: { userId } } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        theme: true,
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

  try {
    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      const input = messageSchema.parse(await request.json());
      const membership = await getMembership(input.groupId, userId);
      if (!membership) return NextResponse.json({ error: "Group not found" }, { status: 404 });
      if (!input.content) return NextResponse.json({ error: "Write a message or attach a photo or video." }, { status: 400 });
      const message = await db.$transaction(async (tx) => {
        const created = await tx.groupMessage.create({
          data: {
            groupId: input.groupId,
            senderId: userId,
            content: input.content ?? "",
          },
          select: { id: true, senderId: true, content: true, createdAt: true },
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
      const fileValue = form.get("media");
      if (fileValue !== null && !(fileValue instanceof File)) {
        return NextResponse.json({ error: "Invalid media upload" }, { status: 400 });
      }
      const file = fileValue instanceof File ? fileValue : null;
      if (file && !(
        (ALLOWED_IMAGE_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_IMAGE_BYTES) ||
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
          select: { id: true, senderId: true, content: true, mediaUrl: true, mediaType: true, createdAt: true },
        });
        await db.groupConversation.update({ where: { id: input.groupId }, data: { updatedAt: created.createdAt } });
        return NextResponse.json({ message: created }, { status: 201 });
      }
      const created = await db.groupMessage.create({
        data: { groupId: input.groupId, senderId: userId, content: input.content ?? "" },
        select: { id: true, senderId: true, content: true, mediaUrl: true, mediaType: true, createdAt: true },
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

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const groupId = z.string().min(1).parse(form.get("groupId"));
      const name = z.string().trim().min(2).max(60).parse(form.get("name"));
      const theme = z.enum(["forest", "ocean", "sunset", "lavender", "midnight"])
        .parse(form.get("theme"));
      const photo = form.get("photo");
      if (photo !== null && !(photo instanceof File)) {
        return NextResponse.json({ error: "Invalid group picture" }, { status: 400 });
      }
      if (photo instanceof File &&
        (!ALLOWED_IMAGE_TYPES.has(photo.type) || photo.size < 1 || photo.size > MAX_IMAGE_BYTES)) {
        return NextResponse.json({ error: "Choose a PNG, JPEG, or WebP picture up to 5 MB" }, { status: 400 });
      }
      const membership = await getMembership(groupId, userId);
      if (!membership?.isAdmin) return NextResponse.json({ error: "Only group admins can edit settings" }, { status: 403 });

      let imageUrl: string | undefined;
      if (photo instanceof File) {
        const uploaded = await uploadImage(
          asDataUrl(photo, Buffer.from(await photo.arrayBuffer())),
          "resident-group-chats",
        );
        imageUrl = uploaded.url;
        newImagePublicId = uploaded.publicId;
      }
      const oldImage = await db.groupConversation.findUnique({
        where: { id: groupId },
        select: { imagePublicId: true },
      });
      const group = await db.groupConversation.update({
        where: { id: groupId },
        data: {
          name,
          theme,
          ...(imageUrl ? { imageUrl, imagePublicId: newImagePublicId } : {}),
        },
        select: { id: true, name: true, imageUrl: true, theme: true },
      });
      if (newImagePublicId && oldImage?.imagePublicId) {
        await deleteImage(oldImage.imagePublicId).catch((error: unknown) => {
          console.error("Failed to remove the previous group picture", error);
        });
      }
      return NextResponse.json({ group });
    }

    const input = updateSchema.parse(await request.json());
    const membership = await getMembership(input.groupId, userId);
    if (!membership) return NextResponse.json({ error: "Group not found" }, { status: 404 });

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
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("Failed to update resident group chat", error);
    return NextResponse.json({ error: "Unable to update group chat" }, { status: 500 });
  }
}
