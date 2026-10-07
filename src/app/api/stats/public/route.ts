import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );
    const nextMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    );
    const previousMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
    );
    const dailyStart = new Date(now);
    dailyStart.setUTCHours(0, 0, 0, 0);
    dailyStart.setUTCDate(dailyStart.getUTCDate() - 89);
    const dailyEnd = new Date(now);
    dailyEnd.setUTCHours(0, 0, 0, 0);
    dailyEnd.setUTCDate(dailyEnd.getUTCDate() + 1);

    const [
      totalResidents,
      recycled,
      currentMonth,
      previousMonth,
      verifiedRecords,
      recentRecords,
    ] =
      await Promise.all([
        db.user.count({ where: { role: "RESIDENT", deletedAt: null } }),
        db.recyclingRecord.aggregate({
          where: { deletedAt: null, verified: true },
          _sum: { weightKg: true, carbonSavedKg: true, pointsEarned: true },
        }),
        db.recyclingRecord.aggregate({
          where: {
            deletedAt: null,
            verified: true,
            collectionDate: { gte: monthStart, lt: nextMonthStart },
          },
          _sum: { weightKg: true },
        }),
        db.recyclingRecord.aggregate({
          where: {
            deletedAt: null,
            verified: true,
            collectionDate: { gte: previousMonthStart, lt: monthStart },
          },
          _sum: { weightKg: true },
        }),
        db.recyclingRecord.count({
          where: { deletedAt: null, verified: true },
        }),
        db.recyclingRecord.findMany({
          where: {
            deletedAt: null,
            verified: true,
            collectionDate: { gte: dailyStart, lt: dailyEnd },
          },
          select: {
            collectionDate: true,
            weightKg: true,
            wasteCategory: { select: { name: true } },
          },
          orderBy: { collectionDate: "asc" },
        }),
      ]);

    const materialTotals = new Map<string, number>();
    for (const record of recentRecords) {
      const name = record.wasteCategory.name;
      materialTotals.set(
        name,
        (materialTotals.get(name) ?? 0) + record.weightKg
      );
    }
    const materials = [...materialTotals.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)
      .map(([name, totalWeightKg]) => ({ name, totalWeightKg }));
    const topMaterialNames = new Set(materials.map((material) => material.name));
    const dailyTotals = new Map<
      string,
      { records: number; weights: Map<string, number> }
    >();
    for (const record of recentRecords) {
      const dayKey = record.collectionDate.toISOString().slice(0, 10);
      const day = dailyTotals.get(dayKey) ?? {
        records: 0,
        weights: new Map<string, number>(),
      };
      day.records += 1;
      if (topMaterialNames.has(record.wasteCategory.name)) {
        day.weights.set(
          record.wasteCategory.name,
          (day.weights.get(record.wasteCategory.name) ?? 0) + record.weightKg
        );
      }
      dailyTotals.set(dayKey, day);
    }
    const dailyImpact = Array.from({ length: 90 }, (_, index) => {
      const date = new Date(dailyStart);
      date.setUTCDate(dailyStart.getUTCDate() + index);
      const day = date.toISOString().slice(0, 10);
      const totals = dailyTotals.get(day);

      return {
        day,
        records: totals?.records ?? 0,
        weights: materials.map(
          (material) => totals?.weights.get(material.name) ?? 0
        ),
      };
    });
    const currentMonthKg = currentMonth._sum.weightKg ?? 0;
    const previousMonthKg = previousMonth._sum.weightKg ?? 0;
    const monthlyChangePercent =
      previousMonthKg > 0
        ? ((currentMonthKg - previousMonthKg) / previousMonthKg) * 100
        : currentMonthKg > 0
          ? null
          : 0;

    return NextResponse.json({
      totalResidents,
      totalRecycledKg: recycled._sum.weightKg ?? 0,
      totalPoints: recycled._sum.pointsEarned ?? 0,
      carbonSavedKg: recycled._sum.carbonSavedKg ?? 0,
      monthlyChangePercent,
      verifiedRecords,
      dailyImpact,
      materials,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[public stats]", error);
    return NextResponse.json({ error: "Public statistics are temporarily unavailable." }, { status: 503 });
  }
}
