import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const authResult = await requireSession();
  if ("error" in authResult) return authResult.error;

  const requestUrl = new URL(request.url);
  if (requestUrl.searchParams.get("unreadByLink") === "1") {
    const [grouped, totalUnread] = await Promise.all([
      db.notification.groupBy({
        by: ["link"],
        where: {
          userId: authResult.session.user.id,
          read: false,
          link: { not: null },
        },
        _count: { _all: true },
      }),
      db.notification.count({
        where: { userId: authResult.session.user.id, read: false },
      }),
    ]);

    const unreadByLink = Object.fromEntries(
      grouped
        .filter((item) => item.link !== null)
        .map((item) => [item.link, item._count._all])
    );
    unreadByLink["/resident/notifications"] = totalUnread;
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

  const { id, link, markAllRead } = await request.json();

  if (markAllRead) {
    await db.notification.updateMany({
      where: { userId: authResult.session.user.id, read: false },
      data: { read: true },
    });
    return NextResponse.json({ success: true });
  }

  if (typeof link === "string" && link.startsWith("/")) {
    const result = await db.notification.updateMany({
      where: {
        userId: authResult.session.user.id,
        read: false,
        ...(link === "/resident/notifications" ? {} : { link }),
      },
      data: { read: true },
    });
    return NextResponse.json({ success: true, count: result.count });
  }

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const notification = await db.notification.update({
    where: { id, userId: authResult.session.user.id },
    data: { read: true },
  });

  return NextResponse.json(notification);
}
