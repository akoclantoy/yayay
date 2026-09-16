import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatWeight } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Leaf, Recycle, Flame, TreePine } from "lucide-react";

export default async function ImpactPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await db.residentProfile.findUnique({
    where: { userId: session.user.id },
  });

  const records = await db.recyclingRecord.groupBy({
    by: ["wasteCategoryId"],
    where: { residentId: session.user.id, deletedAt: null },
    _sum: { weightKg: true, carbonSavedKg: true, pointsEarned: true },
  });

  const categories = await db.wasteCategory.findMany();
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  const totalWeight = profile?.totalWeightKg ?? 0;
  const carbonSaved = profile?.carbonSavedKg ?? 0;
  const treesEquivalent = Math.round(carbonSaved / 21);
  const streak = profile?.recyclingStreak ?? 0;

  const stats = [
    { label: "Total recycled", value: formatWeight(totalWeight), icon: Recycle },
    { label: "Carbon saved", value: formatWeight(carbonSaved), icon: Leaf },
    { label: "Recycling streak", value: `${streak} days`, icon: Flame },
    { label: "Trees equivalent", value: `~${treesEquivalent}`, icon: TreePine },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Environmental Impact</h1>
        <p className="text-muted-foreground">Your contribution to a greener community</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <s.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Impact by waste type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {records.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No data yet</p>
          ) : (
            records.map((r) => {
              const cat = categoryMap[r.wasteCategoryId];
              const weight = r._sum.weightKg ?? 0;
              const pct = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
              return (
                <div key={r.wasteCategoryId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{cat?.name ?? "Unknown"}</span>
                    <span className="text-muted-foreground">
                      {formatWeight(weight)} · {formatWeight(r._sum.carbonSavedKg ?? 0)} CO₂ saved
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
