import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(4096),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(256),
  }),
});
const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(4096),
});

function isPushConfigured() {
  const subject = process.env.VAPID_SUBJECT?.trim();
  return Boolean(
    process.env.VAPID_PUBLIC_KEY?.trim() &&
    process.env.VAPID_PRIVATE_KEY?.trim() &&
    subject &&
    (subject.startsWith("mailto:") || subject.startsWith("https://")),
  );
}

export async function GET(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;

  try {
    const configured = isPushConfigured();
    const endpoint = new URL(request.url).searchParams.get("endpoint");
    const subscription = endpoint
      ? await db.pushSubscription.findFirst({
          where: { userId: authResult.session.user.id, endpoint },
          select: { id: true },
        })
      : null;

    return NextResponse.json({
      configured,
      enabled: Boolean(subscription),
      publicKey: configured ? process.env.VAPID_PUBLIC_KEY?.trim() : null,
    });
  } catch (error) {
    console.error("[resident-push:status]", error);
    return NextResponse.json({ error: "Unable to load device notification settings." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;
  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Device notifications are not configured yet." }, { status: 503 });
  }

  try {
    const parsed = subscriptionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "The browser returned an invalid notification subscription." }, { status: 400 });
    }
    await db.pushSubscription.upsert({
      where: { endpoint: parsed.data.endpoint },
      create: {
        userId: authResult.session.user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
      },
      update: {
        userId: authResult.session.user.id,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
      },
    });
    return NextResponse.json({ enabled: true });
  } catch (error) {
    console.error("[resident-push:subscribe]", error);
    return NextResponse.json({ error: "Unable to enable device notifications." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;

  try {
    const parsed = unsubscribeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "The browser notification subscription is invalid." }, { status: 400 });
    }
    await db.pushSubscription.deleteMany({
      where: {
        userId: authResult.session.user.id,
        endpoint: parsed.data.endpoint,
      },
    });
    return NextResponse.json({ enabled: false });
  } catch (error) {
    console.error("[resident-push:unsubscribe]", error);
    return NextResponse.json({ error: "Unable to disable device notifications." }, { status: 500 });
  }
}
