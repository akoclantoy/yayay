import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatPoints, formatWeight } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal } from "lucide-react";

export default async function LeaderboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [topResidents, topBarangays, myProfile] = await Promise.all([
    db.residentProfile.findMany({
      orderBy: { totalWeightKg: "desc" },
      take: 10,
      include: {
        user: { select: { name: true } },
        barangay: { select: { name: true } },
      },
    }),
    db.barangay.findMany({
      where: { isActive: true, deletedAt: null },
      take: 10,
      include: {
        residents: {
          select: { totalWeightKg: true },
        },
      },
    }),
    db.residentProfile.findUnique({ where: { userId: session.user.id } }),
  ]);

  const barangayRankings = topBarangays
    .map((b) => ({
      name: b.name,
      totalKg: b.residents.reduce((sum, r) => sum + r.totalWeightKg, 0),
      residents: b.residents.length,
    }))
    .sort((a, b) => b.totalKg - a.totalKg);

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

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-warning" />
              Top Residents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topResidents.map((r, i) => (
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
              <Medal className="h-5 w-5 text-secondary" />
              Top Barangays
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {barangayRankings.map((b, i) => (
              <div
                key={b.name}
                className="flex items-center justify-between rounded-xl border border-border/50 p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-lg w-6">{i + 1}</span>
                  <div>
                    <p className="font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.residents} residents</p>
                  </div>
                </div>
                <p className="font-semibold">{formatWeight(b.totalKg)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
