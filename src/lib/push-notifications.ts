import "server-only";
import webpush from "web-push";
import { db } from "@/lib/db";

export type DevicePushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  requireInteraction?: boolean;
};

function getVapidConfiguration() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  const validSubject = subject?.startsWith("mailto:") || subject?.startsWith("https://");
  return publicKey && privateKey && subject && validSubject ? { publicKey, privateKey, subject } : null;
}

export async function sendPushToUsers(userIds: string | string[], payload: DevicePushPayload) {
  const configuration = getVapidConfiguration();
  if (!configuration) return;

  webpush.setVapidDetails(configuration.subject, configuration.publicKey, configuration.privateKey);
  const subscriptions = await db.pushSubscription.findMany({
    where: { userId: { in: [...new Set(Array.isArray(userIds) ? userIds : [userIds])] } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  const results = await Promise.allSettled(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
        { TTL: payload.requireInteraction ? 60 * 60 : 60 * 60 * 24 },
      );
    } catch (error) {
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error
        ? error.statusCode
        : null;
      if (statusCode === 404 || statusCode === 410) {
        await db.pushSubscription.deleteMany({ where: { id: subscription.id } });
        return;
      }
      throw error;
    }
  }));

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[push-notifications] Delivery failed:", result.reason);
    }
  }
}
