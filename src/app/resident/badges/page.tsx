import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { BadgeCollection } from "@/components/resident/badge-collection";

export default async function BadgesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [allBadges, earned] = await Promise.all([
    db.badge.findMany({ orderBy: { name: "asc" } }),
    db.userBadge.findMany({
      where: { userId: session.user.id },
      select: { badgeId: true, bonusPoints: true, earnedAt: true, claimedAt: true },
    }),
  ]);

  const earnedByBadge = new Map(earned.map((entry) => [entry.badgeId, entry]));

  return (
    <BadgeCollection
      initialBadges={allBadges.map((badge) => {
        const entry = earnedByBadge.get(badge.id);
        return {
          id: badge.id,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          criteria: badge.criteria,
          points: entry?.bonusPoints ?? badge.points,
          earnedAt: entry?.earnedAt.toISOString() ?? null,
          claimedAt: entry?.claimedAt?.toISOString() ?? null,
        };
      })}
    />
  );
}
