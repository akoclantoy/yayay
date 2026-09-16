import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validators/auth";
import {
  sendEmail,
  verificationEmailHtml,
} from "@/lib/email";
import { APP_NAME } from "@/lib/constants";
import { getAppUrl } from "@/lib/env";
import { mockRegisterUser, shouldUseMockAuth } from "@/lib/mock-auth";

function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, password, phone } = parsed.data;
    const normalizedEmail = email.toLowerCase();
    const normalizedPhone = phone?.trim() || undefined;
    const smtpConfigured = isSmtpConfigured();

    if (process.env.NODE_ENV !== "production" && shouldUseMockAuth()) {
      const mockResult = mockRegisterUser({ name, email: normalizedEmail, password });

      if (!mockResult.success) {
        return NextResponse.json(
          { error: { email: [mockResult.error] } },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          message: "Account created. You can sign in now.",
          userId: mockResult.user.id,
          autoVerified: true,
        },
        { status: 201 }
      );
    }

    const existing = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: {
            email: ["An account with this email already exists"],
          },
        },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await db.user.create({
      data: {
        name,
        email: normalizedEmail,
        phone: normalizedPhone,
        passwordHash,
        role: "RESIDENT",
        emailVerified: smtpConfigured ? null : new Date(),
        ...(smtpConfigured
          ? {
              emailVerificationTokens: {
                create: { token, expires },
              },
            }
          : {}),
        residentProfile: {
          create: {
            wallet: { create: {} },
          },
        },
      },
    });

    if (!smtpConfigured) {
      return NextResponse.json(
        {
          message: "Account created. You can sign in now.",
          userId: user.id,
          autoVerified: true,
        },
        { status: 201 }
      );
    }

    const baseUrl = getAppUrl();
    const verifyLink = `${baseUrl}/verify-email?token=${token}`;

    try {
      await sendEmail({
        to: normalizedEmail,
        subject: `Verify your ${APP_NAME} account`,
        html: verificationEmailHtml(name, verifyLink),
      });
    } catch (emailError) {
      console.error("[register:email]", emailError);
      await db.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
      await db.emailVerificationToken.deleteMany({
        where: { userId: user.id },
      });

      return NextResponse.json(
        {
          message: "Account created. You can sign in now.",
          userId: user.id,
          autoVerified: true,
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        message:
          "Account created. Please check your email to verify your account.",
        userId: user.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[register]", error);
    const message = error instanceof Error ? error.message : "";
    const isDatabaseError =
      message.includes("Can't reach database server") ||
      message.includes("DATABASE_URL is not configured") ||
      message.includes("ECONNREFUSED") ||
      message.includes("P1001");

    return NextResponse.json(
      {
        error: isDatabaseError
          ? "Registration is temporarily unavailable because the database cannot be reached. Please try again later."
          : "Registration failed. Please try again.",
      },
      { status: 500 }
    );
  }
}
