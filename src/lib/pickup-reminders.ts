import { db } from "@/lib/db";
import { sendPushToUsers } from "@/lib/push-notifications";

export async function deliverDuePickupReminders() {
  const now = new Date();
  const duePickups = await db.pickupRequest.findMany({
    where: {
      scheduledDate: { lte: now },
      reminderSentAt: null,
      deletedAt: null,
      status: { in: ["PENDING", "APPROVED"] },
    },
    select: {
      id: true,
      userId: true,
      assignedStaffId: true,
      address: true,
      scheduledDate: true,
      wasteNotes: true,
    },
    take: 100,
  });

  let delivered = 0;

  for (const pickup of duePickups) {
    const sent = await db.$transaction(async (tx) => {
      const claimed = await tx.pickupRequest.updateMany({
        where: {
          id: pickup.id,
          reminderSentAt: null,
          deletedAt: null,
          status: { in: ["PENDING", "APPROVED"] },
        },
        data: { reminderSentAt: now },
      });
      if (claimed.count === 0) return false;

      const conversation = await tx.conversation.upsert({
        where: { pickupId: pickup.id },
        create: {
          pickupId: pickup.id,
          residentId: pickup.userId,
          staffId: pickup.assignedStaffId,
        },
        update: pickup.assignedStaffId ? { staffId: pickup.assignedStaffId } : {},
        select: { id: true },
      });
      const scheduled = pickup.scheduledDate
        ? new Intl.DateTimeFormat("en-PH", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Manila",
          }).format(pickup.scheduledDate)
        : "now";
      const details = [
        `Your pickup is scheduled for ${scheduled}.`,
        `Pickup location: ${pickup.address}.`,
        pickup.wasteNotes ? `Waste details: ${pickup.wasteNotes}.` : null,
      ].filter(Boolean);

      await tx.conversationMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: pickup.userId,
          content: details.join("\n"),
          systemMessage: true,
        },
      });
      await tx.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: now },
      });
      await tx.notification.create({
        data: {
          userId: pickup.userId,
          title: "Pickup time reached",
          message: "Your pickup details are now available in Messenger.",
          type: "pickup",
          link: "/resident/messages",
        },
      });
      return true;
    });

    if (sent) {
      delivered += 1;
      void sendPushToUsers(pickup.userId, {
        title: "Pickup time reached",
        body: "Your pickup details are now available in Messenger.",
        url: "/resident/messages",
        tag: `pickup-reminder-${pickup.id}`,
      }).catch((error: unknown) => {
        console.error("[pickup-reminders] Failed to send resident push alert:", error);
      });
    }
  }

  return delivered;
}
