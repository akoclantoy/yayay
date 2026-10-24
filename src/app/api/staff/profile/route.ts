import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { normalizePhilippinePhone } from "@/lib/sms-recovery";
import { findUserWithPhone } from "@/lib/phone";

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  phone: z.string().trim().max(24)
    .refine((phone) => !phone || /^\+?[0-9\s().-]+$/.test(phone), "Enter a valid phone number")
    .refine((phone) => !phone || (phone.replace(/\D/g, "").length >= 8 && phone.replace(/\D/g, "").length <= 15), "Enter a valid phone number")
    .optional(),
});

export async function PATCH(request: Request) {
  const authResult = await requireRole([
    "COLLECTION_STAFF",
    "BARANGAY_STAFF",
    "ADMIN",
  ]);
  if ("error" in authResult) return authResult.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const phone = parsed.data.phone?.trim()
      ? normalizePhilippinePhone(parsed.data.phone)
      : null;
    if (parsed.data.phone?.trim() && !phone) {
      return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
    }
    if (phone && await findUserWithPhone(phone, authResult.session.user.id)) {
      return NextResponse.json(
        { error: { phone: ["That phone number is already associated with another account."] } },
        { status: 409 },
      );
    }
    await db.user.update({
      where: { id: authResult.session.user.id },
      data: { ...parsed.data, phone },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[staff:update-profile]", error);
    return NextResponse.json(
      { error: "Unable to save your staff details. Please try again." },
      { status: 500 }
    );
  }
}
