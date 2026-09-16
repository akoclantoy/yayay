import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const record = await db.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record) {
      return NextResponse.json(
        { error: "Invalid or expired verification link" },
        { status: 400 }
      );
    }

    if (record.expires < new Date()) {
      await db.emailVerificationToken.delete({ where: { id: record.id } });
      return NextResponse.json(
        { error: "Verification link has expired" },
        { status: 400 }
      );
    }

    await db.$transaction([
      db.user.update({
        where: { id: record.userId },
        data: { emailVerified: new Date() },
      }),
      db.emailVerificationToken.delete({ where: { id: record.id } }),
    ]);

    return NextResponse.json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("[verify-email]", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
