import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { syncWeightMilestoneBadges } from "@/lib/services/badges";

export async function GET(request: Request) {
  const authResult = await requireSession();
  if ("error" in authResult) return authResult.error;

  const requestUrl = new URL(request.url);
  if (requestUrl.searchParams.get("unreadByLink") === "1") {
    const role = authResult.session.user.role;
    const userId = authResult.session.user.id;
    const [grouped, totalUnread] = await Promise.all([
      db.notification.groupBy({
        by: ["link"],
        where: {
          userId,
          read: false,
          link: { not: null },
        },
        _count: { _all: true },
      }),
      db.notification.count({
        where: { userId, read: false },
      }),
    ]);

    const unreadByLink: Record<string, number> = Object.fromEntries(
      grouped
        .filter((item) => item.link !== null)
        .map((item) => [item.link, item._count._all])
    );
    unreadByLink["/resident/notifications"] = totalUnread;

    if (role === "ADMIN") {
      unreadByLink["/admin/redemptions"] = await db.redemptionRequest.count({
        where: { status: "PENDING", deletedAt: null },
      });
    } else if (role === "COLLECTION_STAFF" || role === "BARANGAY_STAFF") {
      unreadByLink["/staff/pickups"] = await db.pickupRequest.count({
        where: {
          deletedAt: null,
          status: { notIn: ["COMPLETED", "CANCELLED"] },
          OR: [{ assignedStaffId: userId }, { assignedStaffId: null }],
        },
      });
    } else if (role === "RESIDENT") {
      const [unreadMessages] = await Promise.all([
        db.notification.count({
          where: {
            userId,
            read: false,
            link: { startsWith: "/resident/messages" },
          },
        }),
        syncWeightMilestoneBadges(userId),
      ]);
      unreadByLink["/resident/messages"] = unreadMessages;
      unreadByLink["/resident/badges"] = await db.userBadge.count({
        where: { userId, claimedAt: null, bonusPoints: { gt: 0 } },
      });
    }

    return NextResponse.json(unreadByLink);
  }

  const notifications = await db.notification.findMany({
    where: { userId: authResult.session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(notifications);
}

export async function PATCH(request: Request) {
  const authResult = await requireSession();
  if ("error" in authResult) return authResult.error;

  const { id, markAllRead } = await request.json();

  if (markAllRead) {
    await db.notification.updateMany({
      where: { userId: authResult.session.user.id, read: false },
      data: { read: true },
    });
    return NextResponse.json({ success: true });
  }

  if (typeof id !== "string" || id.length === 0) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const notification = await db.notification.update({
    where: { id, userId: authResult.session.user.id },
    data: { read: true },
  });

  return NextResponse.json(notification);
}
