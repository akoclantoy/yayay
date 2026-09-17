import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const [totalResidents, recycled] = await Promise.all([
      db.user.count({ where: { role: "RESIDENT", deletedAt: null } }),
      db.recyclingRecord.aggregate({
        where: { deletedAt: null },
        _sum: { weightKg: true, carbonSavedKg: true, pointsEarned: true },
      }),
    ]);

    return NextResponse.json({
      totalResidents,
      totalRecycledKg: recycled._sum.weightKg ?? 0,
      totalPoints: recycled._sum.pointsEarned ?? 0,
      carbonSavedKg: recycled._sum.carbonSavedKg ?? 0,
    });
  } catch {
    return NextResponse.json({ error: "Public statistics are temporarily unavailable." }, { status: 503 });
  }
}
