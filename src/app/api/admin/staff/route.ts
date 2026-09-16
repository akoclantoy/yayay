import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/api-auth";
import { createStaffSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
  const authResult = await requireRole(["ADMIN"]);
  if ("error" in authResult) return authResult.error;

  try {
    const parsed = createStaffSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();
    const existing = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: { email: ["An account with this email already exists"] } },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        emailVerified: new Date(),
        role: "COLLECTION_STAFF",
        staffProfile: { create: {} },
      },
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("[admin:create-staff]", error);
    return NextResponse.json(
      { error: "Unable to create the staff account. Please try again." },
      { status: 500 }
    );
  }
}