import { db } from "@/lib/db";
import { BadgeManager } from "@/components/admin/badge-manager";

export default async function AdminBadgesPage() {
  const [badges, residents] = await Promise.all([
    db.badge.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { userBadges: true } } },
    }),
    db.user.findMany({
      where: { role: "RESIDENT", isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Badges & bonuses</h1>
        <p className="text-muted-foreground">Recognize resident milestones with claimable wallet bonuses.</p>
      </div>
      <BadgeManager
        initialBadges={badges.map((badge) => ({
          id: badge.id,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          criteria: badge.criteria,
          points: badge.points,
          awards: badge._count.userBadges,
        }))}
        residents={residents.map((resident) => ({
          id: resident.id,
          name: resident.name ?? "Resident",
          email: resident.email,
        }))}
      />
    </div>
  );
}