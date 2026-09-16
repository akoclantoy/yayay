import nodemailer from "nodemailer";
import { APP_NAME } from "@/lib/constants";

const transporter =
  process.env.SMTP_HOST && process.env.SMTP_USER
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      })
    : null;

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}) {
  const from =
    process.env.EMAIL_FROM ?? `"${APP_NAME}" <noreply@example.com>`;

  if (!transporter) {
    console.info("[email:skipped]", options.subject, "→", options.to);
    return { ok: true as const, skipped: true };
  }

  await transporter.sendMail({ from, ...options });
  return { ok: true as const, skipped: false };
}

export function verificationEmailHtml(name: string, link: string) {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
      <h1 style="color: #16A34A;">Verify your ${APP_NAME} account</h1>
      <p>Hi ${name},</p>
      <p>Thanks for joining our community recycling program. Please verify your email:</p>
      <p><a href="${link}" style="background:#16A34A;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Verify Email</a></p>
      <p style="color:#64748b;font-size:14px;">If you did not create this account, you can ignore this message.</p>
    </div>
  `;
}

export function resetPasswordEmailHtml(name: string, link: string) {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
      <h1 style="color: #16A34A;">Reset your password</h1>
      <p>Hi ${name},</p>
      <p>We received a request to reset your password. This link expires in 1 hour.</p>
      <p><a href="${link}" style="background:#16A34A;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Reset Password</a></p>
    </div>
  `;
}
