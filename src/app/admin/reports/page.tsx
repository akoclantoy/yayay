import { db } from "@/lib/db";
import { formatPoints, formatWeight } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminReportsPage() {
  const [
    residents,
    records,
    redemptions,
    pickups,
    byCategory,
    topResidents,
  ] = await Promise.all([
    db.user.count({ where: { role: "RESIDENT", deletedAt: null } }),
    db.recyclingRecord.aggregate({
      where: { deletedAt: null },
      _sum: { weightKg: true, pointsEarned: true, carbonSavedKg: true },
      _count: true,
    }),
    db.redemptionRequest.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: true,
    }),
    db.pickupRequest.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: true,
    }),
    db.recyclingRecord.groupBy({
      by: ["wasteCategoryId"],
      where: { deletedAt: null },
      _sum: { weightKg: true },
      orderBy: { _sum: { weightKg: "desc" } },
    }),
    db.residentProfile.findMany({
      orderBy: { totalWeightKg: "desc" },
      take: 5,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  const categories = await db.wasteCategory.findMany();
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Platform Reports</h1>
        <p className="text-muted-foreground">Recycling and rewards analytics</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Residents</p>
            <p className="text-3xl font-bold">{formatPoints(residents)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Collections</p>
            <p className="text-3xl font-bold">{records._count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total recycled</p>
            <p className="text-3xl font-bold">
              {formatWeight(records._sum.weightKg ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Carbon saved</p>
            <p className="text-3xl font-bold">
              {formatWeight(records._sum.carbonSavedKg ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Recycling by category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {byCategory.map((r) => (
              <div
                key={r.wasteCategoryId}
                className="flex justify-between rounded-lg border p-3 text-sm"
              >
                <span>{catMap[r.wasteCategoryId] ?? "Unknown"}</span>
                <span className="font-medium">
                  {formatWeight(r._sum.weightKg ?? 0)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top recyclers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topResidents.map((r, i) => (
              <div
                key={r.id}
                className="flex justify-between rounded-lg border p-3 text-sm"
              >
                <span>
                  #{i + 1} {r.user.name ?? r.user.email}
                </span>
                <span className="font-medium">
                  {formatWeight(r.totalWeightKg)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Redemptions by status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {redemptions.map((r) => (
              <div
                key={r.status}
                className="flex justify-between rounded-lg border p-3 text-sm"
              >
                <span>{r.status}</span>
                <span className="font-medium">{r._count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pickups by status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pickups.map((p) => (
              <div
                key={p.status}
                className="flex justify-between rounded-lg border p-3 text-sm"
              >
                <span>{p.status}</span>
                <span className="font-medium">{p._count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
