import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award } from "lucide-react";

export default async function BadgesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [allBadges, earned] = await Promise.all([
    db.badge.findMany({ orderBy: { name: "asc" } }),
    db.userBadge.findMany({
      where: { userId: session.user.id },
      include: { badge: true },
    }),
  ]);

  const earnedIds = new Set(earned.map((e) => e.badgeId));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Badges & Achievements</h1>
        <p className="text-muted-foreground">
          {earned.length} of {allBadges.length} badges earned
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allBadges.map((badge) => {
          const isEarned = earnedIds.has(badge.id);
          const earnedAt = earned.find((e) => e.badgeId === badge.id)?.earnedAt;
          return (
            <Card
              key={badge.id}
              className={`transition-all ${isEarned ? "border-primary/30 bg-primary/5" : "opacity-60 grayscale"}`}
            >
              <CardHeader className="text-center">
                <div className="text-4xl mb-2">{badge.icon ?? "🏅"}</div>
                <CardTitle className="text-base">{badge.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">{badge.description}</p>
                {badge.points > 0 && (
                  <Badge variant="secondary">+{badge.points} bonus pts</Badge>
                )}
                {isEarned && earnedAt && (
                  <p className="text-xs text-primary flex items-center justify-center gap-1">
                    <Award className="h-3 w-3" />
                    Earned {new Date(earnedAt).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
