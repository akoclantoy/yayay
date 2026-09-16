import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const authResult = await requireRole(["COLLECTION_STAFF", "ADMIN"]);
  if ("error" in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const qr = searchParams.get("qr")?.trim();

  if (!qr) {
    return NextResponse.json({ error: "QR code required" }, { status: 400 });
  }

  const profile = await db.residentProfile.findFirst({
    where: { qrCode: qr },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          isActive: true,
        },
      },
      barangay: true,
      wallet: { select: { balance: true } },
    },
  });

  if (!profile || !profile.user.isActive) {
    return NextResponse.json({ error: "Resident not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: profile.user.id,
    name: profile.user.name,
    email: profile.user.email,
    image: profile.user.image,
    qrCode: profile.qrCode,
    barangay: profile.barangay?.name,
    balance: profile.wallet?.balance ?? 0,
    totalWeightKg: profile.totalWeightKg,
    environmentalScore: profile.environmentalScore,
  });
}
