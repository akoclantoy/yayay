import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCDate(startDate.getUTCDate() - 29);
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 30);

    const [totalResidents, recycled] = await Promise.all([
      db.user.count({ where: { role: "RESIDENT", deletedAt: null } }),
      db.recyclingRecord.aggregate({
        where: { deletedAt: null, verified: true },
        _sum: { weightKg: true, carbonSavedKg: true, pointsEarned: true },
      }),
    ]);

    const [verifiedRecords, dailyRows] = await Promise.all([
      db.recyclingRecord.count({
        where: { deletedAt: null, verified: true },
      }),
      db.$queryRaw<Array<{ day: string; weightKg: number; records: bigint }>>`
        SELECT
          DATE_FORMAT(collectionDate, '%Y-%m-%d') AS day,
          SUM(weightKg) AS weightKg,
          COUNT(*) AS records
        FROM RecyclingRecord
        WHERE deletedAt IS NULL
          AND verified = TRUE
          AND collectionDate >= ${startDate}
          AND collectionDate < ${endDate}
        GROUP BY DATE(collectionDate)
        ORDER BY DATE(collectionDate) ASC
      `,
    ]);

    const dailyTotals = new Map(
      dailyRows.map((row) => [
        row.day,
        { weightKg: Number(row.weightKg), records: Number(row.records) },
      ])
    );
    const dailyImpact = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(startDate);
      date.setUTCDate(startDate.getUTCDate() + index);
      const day = date.toISOString().slice(0, 10);
      const totals = dailyTotals.get(day);

      return {
        day,
        weightKg: totals?.weightKg ?? 0,
        records: totals?.records ?? 0,
      };
    });

    return NextResponse.json({
      totalResidents,
      totalRecycledKg: recycled._sum.weightKg ?? 0,
      totalPoints: recycled._sum.pointsEarned ?? 0,
      carbonSavedKg: recycled._sum.carbonSavedKg ?? 0,
      verifiedRecords,
      dailyImpact,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Public statistics are temporarily unavailable." }, { status: 503 });
  }
}
