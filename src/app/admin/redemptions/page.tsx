import { db } from "@/lib/db";
import { RedemptionManager } from "@/components/admin/redemption-manager";

export default async function AdminRedemptionsPage() {
  const redemptions = await db.redemptionRequest.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      reward: { select: { name: true } },
    },
  });

  const pending = redemptions.filter((r) => r.status === "PENDING").length;

  const serialized = redemptions.map((r) => ({
    id: r.id,
    points: r.points,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    user: r.user,
    reward: r.reward,
  }));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Redemption Requests</h1>
        <p className="text-muted-foreground">
          {redemptions.length} total · {pending} pending approval
        </p>
      </div>

      <RedemptionManager initial={serialized} />
    </div>
  );
}
