import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { canonicalFriendshipPair } from "@/lib/resident-social";

const ONLINE_WINDOW_MS = 60_000;

export async function POST() {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;

  try {
    const lastSeenAt = new Date();
    await db.user.update({
      where: { id: authResult.session.user.id },
      data: { lastSeenAt },
    });
    return NextResponse.json({ lastSeenAt });
  } catch (error) {
    console.error("Failed to update resident presence", error);
    return NextResponse.json({ error: "Unable to update online status" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;
  const userId = authResult.session.user.id;
  const residentId = new URL(request.url).searchParams.get("residentId");
  if (!residentId || residentId === userId) {
    return NextResponse.json({ error: "A friend is required" }, { status: 400 });
  }

  try {
    const pair = canonicalFriendshipPair(userId, residentId);
    const [friendship, block, resident] = await Promise.all([
      db.friendship.findUnique({ where: { userLowId_userHighId: pair }, select: { id: true } }),
      db.residentBlock.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedId: residentId },
            { blockerId: residentId, blockedId: userId },
          ],
        },
        select: { id: true },
      }),
      db.user.findFirst({
        where: { id: residentId, role: "RESIDENT", isActive: true },
        select: { id: true, lastSeenAt: true },
      }),
    ]);
    if (!friendship || block || !resident) {
      return NextResponse.json({ error: "Resident is not available" }, { status: 404 });
    }
    return NextResponse.json({
      online: Boolean(resident.lastSeenAt && Date.now() - resident.lastSeenAt.getTime() <= ONLINE_WINDOW_MS),
      lastSeenAt: resident.lastSeenAt,
    });
  } catch (error) {
    console.error("Failed to load resident presence", error);
    return NextResponse.json({ error: "Unable to load online status" }, { status: 500 });
  }
}
