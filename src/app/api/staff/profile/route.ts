import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  phone: z.string().trim().max(30, "Phone number is too long"),
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
    await db.user.update({
      where: { id: authResult.session.user.id },
      data: parsed.data,
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
