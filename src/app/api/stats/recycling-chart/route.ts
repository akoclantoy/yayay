import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const RANGES = {
  "7d": { days: 7, unit: "day" },
  "30d": { days: 30, unit: "day" },
  "3m": { days: 90, unit: "day" },
  "1y": { days: 365, unit: "day" },
  all: { days: null, unit: "month" },
} as const;
const RANGE_KEYS = Object.keys(RANGES);

type ChartRow = {
  bucket: Date;
  openKg: number;
  highKg: number;
  lowKg: number;
  closeKg: number;
  totalWeightKg: number;
  transactions: number;
};

type TotalsRow = {
  totalWeightKg: number;
  transactions: number;
  activeParticipants: number;
};

export async function GET(request: Request) {
  try {
    const requestedRange = new URL(request.url).searchParams.get("range") ?? "30d";
    if (!RANGE_KEYS.includes(requestedRange)) {
      return NextResponse.json({ error: "Unsupported chart range." }, { status: 400 });
    }
    const range = RANGES[requestedRange as keyof typeof RANGES];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const startDate = range.days === null
      ? null
      : new Date(today.getTime() - (range.days - 1) * 24 * 60 * 60_000);
    const endDate = new Date(today.getTime() + 24 * 60 * 60_000);

    const [rows, totals] = await Promise.all([
      db.$queryRaw<ChartRow[]>`
        SELECT
          date_trunc(${range.unit}, "collectionDate" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS bucket,
          (ARRAY_AGG("weightKg" ORDER BY "collectionDate" ASC, "id" ASC))[1]::float AS "openKg",
          MAX("weightKg")::float AS "highKg",
          MIN("weightKg")::float AS "lowKg",
          (ARRAY_AGG("weightKg" ORDER BY "collectionDate" DESC, "id" DESC))[1]::float AS "closeKg",
          SUM("weightKg")::float AS "totalWeightKg",
          COUNT(*)::int AS transactions
        FROM ecorewards."RecyclingRecord"
        WHERE "verified" = true
          AND "deletedAt" IS NULL
          AND "collectionDate" < ${endDate}
          AND (${startDate}::timestamptz IS NULL OR "collectionDate" >= ${startDate})
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      db.$queryRaw<TotalsRow[]>`
        SELECT
          COALESCE(SUM("weightKg"), 0)::float AS "totalWeightKg",
          COUNT(*)::int AS transactions,
          COUNT(DISTINCT "residentId")::int AS "activeParticipants"
        FROM ecorewards."RecyclingRecord"
        WHERE "verified" = true
          AND "deletedAt" IS NULL
          AND "collectionDate" < ${endDate}
      `,
    ]);

    return NextResponse.json({
      range: requestedRange,
      unit: range.unit,
      totals: totals[0] ?? { totalWeightKg: 0, transactions: 0, activeParticipants: 0 },
      candles: rows.map((row) => ({
        date: row.bucket.toISOString(),
        openKg: Number(row.openKg),
        highKg: Number(row.highKg),
        lowKg: Number(row.lowKg),
        closeKg: Number(row.closeKg),
        totalWeightKg: Number(row.totalWeightKg),
        transactions: Number(row.transactions),
      })),
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[recycling-chart]", error);
    return NextResponse.json(
      { error: "Verified recycling data is temporarily unavailable." },
      { status: 503 },
    );
  }
}
