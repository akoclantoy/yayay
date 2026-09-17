import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";

const announcementSchema = z.object({
  title: z.string().trim().min(1).max(160),
  content: z.string().trim().min(1).max(5000),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  isPinned: z.boolean().default(false),
});

const updateSchema = announcementSchema.extend({ id: z.string().min(1) });

export async function POST(request: Request) {
  const authResult = await requireRole(["ADMIN"]);
  if ("error" in authResult) return authResult.error;

  try {
    const input = announcementSchema.parse(await request.json());
    const recipients = await db.user.findMany({
      where: { role: "RESIDENT", isActive: true, deletedAt: null },
      select: { id: true },
    });
    const announcement = await db.$transaction(async (tx) => {
      const created = await tx.announcement.create({
        data: {
          title: input.title,
          content: input.content,
          priority: input.priority,
          isPinned: input.isPinned,
          expiresAt: null,
          authorId: authResult.session.user.id,
        },
      });

      if (recipients.length > 0) {
        await tx.notification.createMany({
          data: recipients.map((recipient) => ({
            userId: recipient.id,
            title: input.title,
            message: input.content,
            type: "announcement",
            link: "/resident/notifications",
          })),
        });
      }

      return created;
    });

    return NextResponse.json(
      { announcement, recipientCount: recipients.length },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to publish announcement" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const authResult = await requireRole(["ADMIN"]);
  if ("error" in authResult) return authResult.error;

  try {
    const input = updateSchema.parse(await request.json());
    const announcement = await db.announcement.update({
      where: { id: input.id },
      data: {
        title: input.title,
        content: input.content,
        priority: input.priority,
        isPinned: input.isPinned,
        expiresAt: null,
      },
      include: { author: { select: { name: true } } },
    });
    return NextResponse.json(announcement);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update announcement" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const authResult = await requireRole(["ADMIN"]);
  if ("error" in authResult) return authResult.error;

  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(await request.json());
    await db.announcement.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete announcement" },
      { status: 500 }
    );
  }
}
