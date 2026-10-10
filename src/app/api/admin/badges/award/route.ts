import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";

const awardSchema = z.object({
  badgeId: z.string().min(1),
  userId: z.string().min(1),
});

export async function POST(request: Request) {
  const authResult = await requireRole(["ADMIN"]);
  if ("error" in authResult) return authResult.error;

  try {
    const { badgeId, userId } = awardSchema.parse(await request.json());
    const resident = await db.user.findFirst({
      where: { id: userId, role: "RESIDENT", isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!resident) {
      return NextResponse.json({ error: "Active resident not found" }, { status: 404 });
    }

    const badge = await db.badge.findUnique({
      where: { id: badgeId },
      select: { points: true },
    });
    if (!badge) {
      return NextResponse.json({ error: "Badge not found" }, { status: 404 });
    }

    const earned = await db.userBadge.create({
      data: { userId, badgeId, bonusPoints: badge.points },
    });
    return NextResponse.json(earned, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "This resident already has that badge" }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to award badge" },
      { status: 500 }
    );
  }
}
