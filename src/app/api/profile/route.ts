import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { normalizePhilippinePhone } from "@/lib/sms-recovery";
import { findUserWithPhone } from "@/lib/phone";

const schema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().trim().max(24)
    .refine((phone) => !phone || /^\+?[0-9\s().-]+$/.test(phone), "Enter a valid phone number")
    .refine((phone) => !phone || (phone.replace(/\D/g, "").length >= 8 && phone.replace(/\D/g, "").length <= 15), "Enter a valid phone number")
    .optional(),
  address: z.string().optional(),
  houseNumber: z.string().optional(),
  barangayId: z.string().optional(),
});

export async function PATCH(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;

  try {
    const data = schema.parse(await request.json());
    const userId = authResult.session.user.id;
    const barangayId = data.barangayId || null;
    const phone = data.phone?.trim()
      ? normalizePhilippinePhone(data.phone)
      : null;
    if (data.phone?.trim() && !phone) {
      return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
    }
    if (phone && await findUserWithPhone(phone, userId)) {
      return NextResponse.json(
        { error: "That phone number is already associated with another account." },
        { status: 409 },
      );
    }

    if (barangayId) {
      const barangay = await db.barangay.findFirst({
        where: {
          id: barangayId,
          code: { startsWith: "TUPI-" },
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!barangay) {
        return NextResponse.json({ error: "Select an active barangay" }, { status: 400 });
      }
    }

    await db.$transaction(async (tx) => {
      if (data.name || data.phone !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: {
            name: data.name,
            phone,
          },
        });
      }

      await tx.residentProfile.upsert({
        where: { userId },
        update: {
          address: data.address,
          houseNumber: data.houseNumber,
          barangayId,
        },
        create: {
          userId,
          address: data.address,
          houseNumber: data.houseNumber,
          barangayId,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
