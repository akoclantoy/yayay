import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

function getPepper() {
  const pepper = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!pepper) throw new Error("AUTH_SECRET is required for SMS account recovery.");
  return pepper;
}

export function hashRecoveryValue(value: string) {
  return createHmac("sha256", getPepper()).update(value).digest("hex");
}

export function createRecoveryCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function createResetToken() {
  return randomBytes(32).toString("hex");
}

export function recoveryValuesMatch(actual: string, expectedHash: string) {
  const actualHash = Buffer.from(hashRecoveryValue(actual), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actualHash.length === expected.length && timingSafeEqual(actualHash, expected);
}

export function normalizePhilippinePhone(phone: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  const e164 = phone.trim().startsWith("+")
    ? `+${digits}`
    : digits.startsWith("0")
      ? `+63${digits.slice(1)}`
      : digits.startsWith("63")
        ? `+${digits}`
        : `+${digits}`;
  return PHONE_PATTERN.test(e164) ? e164 : null;
}

export async function sendRecoverySms(to: string, message: string) {
  const serviceUrl = process.env.SMS_SERVICE_URL;
  const serviceToken = process.env.SMS_SERVICE_TOKEN;
  if (!serviceUrl || !serviceToken) {
    throw new Error("The SMS recovery service is not configured.");
  }

  const response = await fetch(new URL("/sms", serviceUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to, message }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`SMS delivery service returned ${response.status}.`);
}
