import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { normalizePhilippinePhone } from "@/lib/sms-recovery";
import { findUserWithPhone } from "@/lib/phone";
import { z } from "zod";

const schema = z.object({
  phone: z.string().trim().min(8).max(24).regex(/^\+?[0-9\s().-]+$/),
});

export async function POST(request: Request) {
  const authResult = await requireRole([
    "ADMIN",
    "RESIDENT",
    "COLLECTION_STAFF",
    "BARANGAY_STAFF",
  ], { requirePhone: false });
  if ("error" in authResult) return authResult.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  const phone = parsed.success ? normalizePhilippinePhone(parsed.data.phone) : null;
  if (!phone) {
    return NextResponse.json(
      { error: "Enter a valid phone number in international or local format." },
      { status: 400 },
    );
  }

  try {
    if (await findUserWithPhone(phone, authResult.session.user.id)) {
      return NextResponse.json(
        { error: "That phone number is already associated with another account." },
        { status: 409 },
      );
    }

    await db.user.update({
      where: { id: authResult.session.user.id },
      data: { phone },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[auth:complete-profile]", error);
    return NextResponse.json(
      { error: "Unable to save your phone number. Please try again." },
      { status: 500 },
    );
  }
}
