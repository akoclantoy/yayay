import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";

const badgeSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().nullable(),
  icon: z.string().trim().max(12).optional().nullable(),
  criteria: z.string().trim().max(500).optional().nullable(),
  points: z.number().int().min(0).max(100000),
});

export async function POST(request: Request) {
  const authResult = await requireRole(["ADMIN"]);
  if ("error" in authResult) return authResult.error;

  try {
    const payload = badgeSchema.parse(await request.json());
    const badge = await db.badge.create({
      data: {
        ...payload,
        description: payload.description || null,
        icon: payload.icon || null,
        criteria: payload.criteria || null,
      },
      include: { _count: { select: { userBadges: true } } },
    });
    return NextResponse.json(badge, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create badge" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const authResult = await requireRole(["ADMIN"]);
  if ("error" in authResult) return authResult.error;

  try {
    const payload = badgeSchema.extend({ id: z.string().min(1) }).parse(await request.json());
    const badge = await db.badge.update({
      where: { id: payload.id },
      data: {
        name: payload.name,
        description: payload.description || null,
        icon: payload.icon || null,
        criteria: payload.criteria || null,
        points: payload.points,
      },
      include: { _count: { select: { userBadges: true } } },
    });
    return NextResponse.json(badge);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update badge" },
      { status: 500 }
    );
  }
}
