import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatWeight, formatPoints } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function StaffReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  const [todayCount, weekRecords, byCategory] = await Promise.all([
    db.recyclingRecord.count({
      where: {
        recordedById: session.user.id,
        collectionDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        deletedAt: null,
      },
    }),
    db.recyclingRecord.aggregate({
      where: {
        recordedById: session.user.id,
        collectionDate: { gte: weekStart },
        deletedAt: null,
      },
      _sum: { weightKg: true, pointsEarned: true },
      _count: true,
    }),
    db.recyclingRecord.groupBy({
      by: ["wasteCategoryId"],
      where: { recordedById: session.user.id, deletedAt: null },
      _sum: { weightKg: true },
    }),
  ]);

  const categories = await db.wasteCategory.findMany();
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Staff Reports</h1>
        <p className="text-muted-foreground">Your collection performance summary</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Today</p>
            <p className="text-3xl font-bold">{todayCount}</p>
            <p className="text-xs text-muted-foreground">records</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">This week</p>
            <p className="text-3xl font-bold">{weekRecords._count}</p>
            <p className="text-xs text-muted-foreground">records</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Week total</p>
            <p className="text-3xl font-bold">{formatWeight(weekRecords._sum.weightKg ?? 0)}</p>
            <p className="text-xs text-muted-foreground">
              {formatPoints(weekRecords._sum.pointsEarned ?? 0)} pts issued
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>By waste type</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {byCategory.map((r) => (
            <div key={r.wasteCategoryId} className="flex justify-between rounded-lg border p-3">
              <span>{catMap[r.wasteCategoryId] ?? "Unknown"}</span>
              <span className="font-medium">{formatWeight(r._sum.weightKg ?? 0)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
