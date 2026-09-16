import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET() {
  const authResult = await requireSession();
  if ("error" in authResult) return authResult.error;

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

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const notification = await db.notification.update({
    where: { id, userId: authResult.session.user.id },
    data: { read: true },
  });

  return NextResponse.json(notification);
}
