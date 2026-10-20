import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { deliverDuePickupReminders } from "@/lib/pickup-reminders";
import { isWithinTupi } from "@/lib/tupi";
import { z } from "zod";

const createSchema = z.object({
  address: z.string().min(5),
  scheduledDate: z
    .string()
    .datetime()
    .optional()
    .refine((value) => !value || new Date(value).getTime() > Date.now(), {
      message: "Pickup time must be in the future.",
    }),
  wasteNotes: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
});

export async function POST(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;

  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    if (!isWithinTupi(data.latitude, data.longitude)) {
      return NextResponse.json(
        { error: "Pickup location must be within Tupi, South Cotabato." },
        { status: 400 }
      );
    }

    const pickup = await db.$transaction(async (tx) => {
      const pickup = await tx.pickupRequest.create({
        data: {
          userId: authResult.session.user.id,
          address: data.address,
          scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
          wasteNotes: data.wasteNotes,
          latitude: data.latitude,
          longitude: data.longitude,
        },
      });
      await tx.conversation.create({
        data: {
          pickupId: pickup.id,
          residentId: authResult.session.user.id,
        },
      });
      await tx.notification.create({
        data: {
          userId: authResult.session.user.id,
          title: "Pickup requested",
          message: "Your pickup request has been submitted and is pending approval.",
          type: "pickup",
          link: "/resident/pickup",
        },
      });
      const portalRecipients = await tx.user.findMany({
        where: {
          role: { in: ["COLLECTION_STAFF", "BARANGAY_STAFF", "ADMIN"] },
          isActive: true,
          deletedAt: null,
        },
        select: { id: true, role: true },
      });
      if (portalRecipients.length > 0) {
        await tx.notification.createMany({
          data: portalRecipients.map((recipient) => ({
            userId: recipient.id,
            title: "New pickup request",
            message: "A resident submitted a new pickup request in Tupi.",
            type: "pickup",
            link: recipient.role === "ADMIN" ? "/admin/pickups" : "/staff/pickups",
          })),
        });
      }
      return pickup;
    });

    return NextResponse.json(pickup, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("[pickup] Failed to create request:", error);
    return NextResponse.json({ error: "Failed to create pickup" }, { status: 500 });
  }
}

export async function GET() {
  const authResult = await requireRole(["RESIDENT", "COLLECTION_STAFF", "BARANGAY_STAFF", "ADMIN"]);
  if ("error" in authResult) return authResult.error;
  await deliverDuePickupReminders();

  const role = authResult.session.user.role;
  const userId = authResult.session.user.id;

  const where =
    role === "RESIDENT"
      ? { userId, deletedAt: null }
      : role === "ADMIN"
        ? { deletedAt: null }
        : {
            deletedAt: null,
            OR: [{ assignedStaffId: userId }, { assignedStaffId: null }],
          };

  const pickups = await db.pickupRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      assignedStaff: { select: { name: true } },
      conversation: { select: { id: true, staffId: true } },
    },
  });

  return NextResponse.json(pickups);
}

export async function PATCH(request: Request) {
  const authResult = await requireRole(["COLLECTION_STAFF", "BARANGAY_STAFF", "ADMIN"]);
  if ("error" in authResult) return authResult.error;

  try {
    const parsed = z.object({
      id: z.string().min(1),
      status: z.enum(["PENDING", "APPROVED", "COLLECTED", "COMPLETED", "CANCELLED"]),
      assignedStaffId: z.string().nullable().optional(),
    }).safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { id, status, assignedStaffId } = parsed.data;

    const existing = await db.pickupRequest.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, assignedStaffId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Pickup not found" }, { status: 404 });
    }
    if (
      authResult.session.user.role !== "ADMIN" &&
      existing.assignedStaffId &&
      existing.assignedStaffId !== authResult.session.user.id
    ) {
      return NextResponse.json(
        { error: "This pickup is assigned to another staff member." },
        { status: 403 }
      );
    }
    if (assignedStaffId && authResult.session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can assign another staff member." }, { status: 403 });
    }
    if (assignedStaffId) {
      const staff = await db.user.findFirst({
        where: {
          id: assignedStaffId,
          role: { in: ["COLLECTION_STAFF", "BARANGAY_STAFF"] },
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!staff) {
        return NextResponse.json({ error: "Select an active staff account." }, { status: 400 });
      }
    }
    const nextStaffId =
      authResult.session.user.role === "ADMIN"
        ? assignedStaffId === undefined
          ? existing.assignedStaffId
          : assignedStaffId
        : existing.assignedStaffId ?? authResult.session.user.id;

    const pickup = await db.$transaction(async (tx) => {
      const pickup = await tx.pickupRequest.update({
        where: { id },
        data: {
          status,
          assignedStaffId: nextStaffId,
          collectedAt: status === "COLLECTED" || status === "COMPLETED" ? new Date() : undefined,
        },
        include: { user: { select: { id: true, name: true } } },
      });
      await tx.conversation.updateMany({
        where: { pickupId: id },
        data: { staffId: nextStaffId },
      });
      await tx.notification.create({
        data: {
          userId: pickup.userId,
          title: "Pickup update",
          message: `Your pickup request is now ${status.toLowerCase().replace("_", " ")}.`,
          type: "pickup",
          link: "/resident/pickup",
        },
      });
      if (authResult.session.user.role === "ADMIN") {
        if (nextStaffId && nextStaffId !== authResult.session.user.id) {
          await tx.notification.create({
            data: {
              userId: nextStaffId,
              title: "Pickup assignment updated",
              message: `A pickup request is now ${status.toLowerCase().replace("_", " ")}.`,
              type: "pickup",
              link: "/staff/pickups",
            },
          });
        }
      } else {
        const admins = await tx.user.findMany({
          where: { role: "ADMIN", isActive: true, deletedAt: null },
          select: { id: true },
        });
        if (admins.length > 0) {
          await tx.notification.createMany({
            data: admins.map((admin) => ({
              userId: admin.id,
              title: "Pickup request updated",
              message: `A staff member updated a pickup to ${status.toLowerCase().replace("_", " ")}.`,
              type: "pickup",
              link: "/admin/pickups",
            })),
          });
        }
      }
      return pickup;
    });

    return NextResponse.json(pickup);
  } catch (error) {
    console.error("[pickup] Failed to update request:", error);
    return NextResponse.json({ error: "Failed to update pickup" }, { status: 500 });
  }
}
