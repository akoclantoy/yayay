import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatPoints, formatWeight } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Medal, Trophy } from "lucide-react";
import { getTupiBarangayActivity } from "@/lib/tupi-activity";

export default async function LeaderboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [topResidents, myProfile, barangayActivity] = await Promise.all([
    db.residentProfile.findMany({
      where: {
        barangay: { is: { code: { startsWith: "TUPI-" } } },
        user: { is: { deletedAt: null, isActive: true } },
      },
      orderBy: [{ environmentalScore: "desc" }, { totalWeightKg: "desc" }],
      take: 100,
      include: {
        user: { select: { name: true } },
        barangay: { select: { name: true } },
      },
    }),
    db.residentProfile.findUnique({ where: { userId: session.user.id } }),
    getTupiBarangayActivity(),
  ]);
  const topBarangays = [...barangayActivity]
    .sort((a, b) => b.recycledKg - a.recycledKg || b.collections - a.collections)
    .slice(0, 10);

  const myRank =
    topResidents.findIndex((r) => r.userId === session.user!.id) + 1;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-muted-foreground">
          {myProfile && myRank > 0
            ? `You're ranked #${myRank} this month`
            : "Top recyclers in your community"}
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-warning" />
              Tupi resident leaderboard
            </CardTitle>
            <p className="text-sm text-muted-foreground">The top 10 residents across Tupi barangays, ranked by environmental score.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {topResidents.slice(0, 10).map((r, i) => (
              <div
                key={r.id}
                className={`flex items-center justify-between rounded-xl p-3 ${
                  r.userId === session.user!.id ? "bg-primary/10 border border-primary/20" : "border border-border/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-lg w-6">{i + 1}</span>
                  <div>
                    <p className="font-medium">{r.user.name ?? "Resident"}</p>
                    <p className="text-xs text-muted-foreground">{r.barangay?.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatWeight(r.totalWeightKg)}</p>
                  <p className="text-xs text-muted-foreground">
                    Score: {formatPoints(r.environmentalScore)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Medal className="h-5 w-5 text-emerald-600" />
              Barangay leaderboard
            </CardTitle>
            <p className="text-sm text-muted-foreground">Community recycling activity in Tupi, ranked by total collected weight.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {topBarangays.map((barangay, index) => (
              <div key={barangay.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-50 font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{barangay.name}</p>
                    <p className="text-xs text-muted-foreground">{formatPoints(barangay.residents)} registered residents</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatWeight(barangay.recycledKg)}</p>
                  <p className="text-xs text-muted-foreground">{formatPoints(barangay.collections)} collections</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
