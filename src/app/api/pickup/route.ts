import { NextResponse } from "next/server";
import { requireRole, requireSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  address: z.string().min(5),
  scheduledDate: z.string().datetime().optional(),
  wasteNotes: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export async function POST(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const pickup = await db.pickupRequest.create({
      data: {
        userId: authResult.session.user.id,
        address: data.address,
        scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
        wasteNotes: data.wasteNotes,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });

    await db.notification.create({
      data: {
        userId: authResult.session.user.id,
        title: "Pickup requested",
        message: "Your pickup request has been submitted and is pending approval.",
        type: "pickup",
        link: "/resident/pickup",
      },
    });

    return NextResponse.json(pickup, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create pickup" }, { status: 500 });
  }
}

export async function GET() {
  const authResult = await requireSession();
  if ("error" in authResult) return authResult.error;

  const role = authResult.session.user.role;
  const userId = authResult.session.user.id;

  const where =
    role === "RESIDENT"
      ? { userId, deletedAt: null }
      : { deletedAt: null };

  const pickups = await db.pickupRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      assignedStaff: { select: { name: true } },
    },
  });

  return NextResponse.json(pickups);
}

export async function PATCH(request: Request) {
  const authResult = await requireRole(["COLLECTION_STAFF", "ADMIN"]);
  if ("error" in authResult) return authResult.error;

  try {
    const { id, status, assignedStaffId } = await request.json();
    if (!id || !status) {
      return NextResponse.json({ error: "id and status required" }, { status: 400 });
    }

    const pickup = await db.pickupRequest.update({
      where: { id },
      data: {
        status,
        assignedStaffId: assignedStaffId ?? undefined,
        collectedAt: status === "COLLECTED" || status === "COMPLETED" ? new Date() : undefined,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    await db.notification.create({
      data: {
        userId: pickup.userId,
        title: "Pickup update",
        message: `Your pickup request is now ${status.toLowerCase().replace("_", " ")}.`,
        type: "pickup",
        link: "/resident/pickup",
      },
    });

    return NextResponse.json(pickup);
  } catch {
    return NextResponse.json({ error: "Failed to update pickup" }, { status: 500 });
  }
}
