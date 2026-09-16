import { MIN_GCASH_REDEMPTION_POINTS } from "@/lib/constants";

export type GCashRewardMetadata = {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  imageUrl: string;
  type: "CASH";
};

export const GCASH_REWARD_ID = "gcash-redemption";

export function sanitizeGcashNumber(value: string) {
  const normalized = value.trim().replace(/[\s\-()]/g, "");
  const prefixed = normalized.startsWith("+63") ? normalized.slice(3) : normalized;
  const digitsOnly = prefixed.replace(/\D/g, "");
  const cleaned = digitsOnly.startsWith("63") ? digitsOnly.slice(2) : digitsOnly;

  if (!cleaned) return "";
  return cleaned.startsWith("0") ? cleaned : `0${cleaned}`;
}

export function parseGcashNotes(notes: string | null) {
  if (!notes) return null;

  try {
    const parsed = JSON.parse(notes);
    return typeof parsed === "object" && parsed ? parsed : null;
  } catch {
    return null;
  }
}

export function getGcashRewardMetadata(): GCashRewardMetadata {
  return {
    id: GCASH_REWARD_ID,
    name: "GCash Redemption",
    description: "Request a cash payout through GCash. Upload your QR code and provide your registered GCash mobile number for admin review.",
    pointsCost: MIN_GCASH_REDEMPTION_POINTS,
    imageUrl: "/gcash.svg",
    type: "CASH",
  };
}
