import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { isWithinTupi, TUPI_BOUNDS } from "@/lib/tupi";

export const dynamic = "force-dynamic";

export async function GET() {
  const authResult = await requireRole(["RESIDENT", "COLLECTION_STAFF", "BARANGAY_STAFF", "ADMIN"]);
  if ("error" in authResult) return authResult.error;

  const [[south, west], [north, east]] = TUPI_BOUNDS;
  const pickups = await db.pickupRequest.findMany({
    where: {
      deletedAt: null,
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      latitude: { gte: south, lte: north },
      longitude: { gte: west, lte: east },
    },
    select: { latitude: true, longitude: true },
    take: 10_000,
    orderBy: { createdAt: "desc" },
  });

  const cellSize = 0.006;
  const cells = new Map<string, { latitude: number; longitude: number; count: number }>();
  for (const pickup of pickups) {
    if (pickup.latitude === null || pickup.longitude === null) continue;
    if (!isWithinTupi(pickup.latitude, pickup.longitude)) continue;
    const row = Math.floor((pickup.latitude - south) / cellSize);
    const column = Math.floor((pickup.longitude - west) / cellSize);
    const key = `${row}:${column}`;
    const cell = cells.get(key) ?? {
      latitude: south + (row + 0.5) * cellSize,
      longitude: west + (column + 0.5) * cellSize,
      count: 0,
    };
    cell.count += 1;
    cells.set(key, cell);
  }

  return NextResponse.json(
    [...cells.entries()]
      .filter(([, cell]) => cell.count >= 3)
      .map(([id, cell]) => ({
      id,
      name: "Nearby pickup activity",
      latitude: cell.latitude,
      longitude: cell.longitude,
      value: cell.count,
      detail: `${cell.count} pickup${cell.count === 1 ? "" : "s"} · last 90 days · approximate 600 m activity area`,
      kind: "heat",
      }))
  );
}
