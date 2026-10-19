import { db } from "@/lib/db";

export async function getTupiBarangayActivity() {
  const barangays = await db.barangay.findMany({
    where: { code: { startsWith: "TUPI-" }, isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { residents: true, collectionCenters: true } },
    },
  });

  const barangayIds = barangays.map((barangay) => barangay.id);
  const recyclingByResident = barangayIds.length
    ? await db.recyclingRecord.groupBy({
        by: ["residentId"],
        where: {
          deletedAt: null,
          resident: { is: { barangayId: { in: barangayIds } } },
        },
        _sum: { weightKg: true, pointsEarned: true },
        _count: { _all: true },
      })
    : [];
  const residents = recyclingByResident.length
    ? await db.residentProfile.findMany({
        where: {
          userId: { in: recyclingByResident.map((item) => item.residentId) },
        },
        select: { userId: true, barangayId: true },
      })
    : [];
  const residentBarangays = new Map(
    residents.map((resident) => [resident.userId, resident.barangayId])
  );
  const activityByBarangay = new Map(
    barangays.map((barangay) => [
      barangay.id,
      { collections: 0, recycledKg: 0, pointsEarned: 0 },
    ])
  );

  for (const item of recyclingByResident) {
    const barangayId = residentBarangays.get(item.residentId);
    if (!barangayId) continue;
    const activity = activityByBarangay.get(barangayId);
    if (!activity) continue;
    activity.collections += item._count._all;
    activity.recycledKg += item._sum.weightKg ?? 0;
    activity.pointsEarned += item._sum.pointsEarned ?? 0;
  }

  return barangays.map((barangay) => {
    const activity = activityByBarangay.get(barangay.id);
    return {
      id: barangay.id,
      code: barangay.code,
      name: barangay.name,
      address: barangay.address,
      latitude: barangay.latitude ?? 6.3313349,
      longitude: barangay.longitude ?? 124.9511647,
      residents: barangay._count.residents,
      centers: barangay._count.collectionCenters,
      collections: activity?.collections ?? 0,
      recycledKg: activity?.recycledKg ?? 0,
      pointsEarned: activity?.pointsEarned ?? 0,
    };
  });
}
