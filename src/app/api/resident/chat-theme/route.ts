import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { uploadImage } from "@/lib/cloudinary";
import { db } from "@/lib/db";

const themeSchema = z.object({
  conversationId: z.string().min(1),
  theme: z.enum(["forest", "ocean", "sunset", "lavender", "midnight"]).optional(),
  clearBackground: z.boolean().optional(),
});

const MAX_BACKGROUND_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function asDataUrl(file: File, bytes: Buffer) {
  return `data:${file.type};base64,${bytes.toString("base64")}`;
}

export async function PATCH(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;
  const userId = authResult.session.user.id;
  let uploadedUrl: string | undefined;

  try {
    const form = await request.formData();
    const input = themeSchema.parse({
      conversationId: form.get("conversationId"),
      theme: form.get("theme") ?? undefined,
      clearBackground: form.get("clearBackground") === "true",
    });
    const file = form.get("background");
    if (file !== null && !(file instanceof File)) {
      return NextResponse.json({ error: "Invalid background image" }, { status: 400 });
    }
    if (file instanceof File) {
      if (!ALLOWED_TYPES.has(file.type) || file.size < 1 || file.size > MAX_BACKGROUND_BYTES) {
        return NextResponse.json({ error: "Choose a PNG, JPEG, or WebP image up to 5 MB" }, { status: 400 });
      }
    }

    const conversation = await db.directConversation.findFirst({
      where: {
        id: input.conversationId,
        OR: [{ participantLowId: userId }, { participantHighId: userId }],
      },
      select: {
        id: true,
        participantLowId: true,
        participantHighId: true,
      },
    });
    if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    const friendId = conversation.participantLowId === userId
      ? conversation.participantHighId
      : conversation.participantLowId;
    const pair = userId < friendId
      ? { userLowId: userId, userHighId: friendId }
      : { userLowId: friendId, userHighId: userId };
    if (!(await db.friendship.findUnique({ where: { userLowId_userHighId: pair } }))) {
      return NextResponse.json({ error: "Conversation is no longer available" }, { status: 403 });
    }

    if (file instanceof File) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const uploaded = await uploadImage(asDataUrl(file, bytes), "resident-chat-backgrounds");
      uploadedUrl = uploaded.url;
    }

    const updated = await db.directConversation.update({
      where: { id: conversation.id },
      data: {
        ...(input.theme ? { theme: input.theme } : {}),
        ...(uploadedUrl ? { backgroundImageUrl: uploadedUrl } : {}),
        ...(input.clearBackground ? { backgroundImageUrl: null } : {}),
      },
      select: { id: true, theme: true, backgroundImageUrl: true },
    });
    return NextResponse.json({ conversation: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("Failed to update resident conversation theme", error);
    return NextResponse.json({ error: "Unable to update conversation theme" }, { status: 500 });
  }
}
