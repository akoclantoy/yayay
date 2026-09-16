import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { forgotPasswordSchema } from "@/lib/validators/auth";
import { sendEmail, resetPasswordEmailHtml } from "@/lib/email";
import { APP_NAME } from "@/lib/constants";
import { getAppUrl } from "@/lib/env";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase();
    const user = await db.user.findFirst({
      where: { email, deletedAt: null, isActive: true },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        message: "If an account exists, a reset link has been sent.",
      });
    }

    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await db.passwordResetToken.create({
      data: { token, userId: user.id, expires },
    });

    const baseUrl = getAppUrl();
    const resetLink = `${baseUrl}/reset-password?token=${token}`;

    const emailResult = await sendEmail({
      to: email,
      subject: `Reset your ${APP_NAME} password`,
      html: resetPasswordEmailHtml(user.name ?? "there", resetLink),
    });

    if (emailResult.skipped) {
      console.info("[forgot-password] reset link (email not configured):", resetLink);
    }

    return NextResponse.json({
      message: "If an account exists, a reset link has been sent.",
    });
  } catch (error) {
    console.error("[forgot-password]", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
