import { db } from "@/lib/db";
import { formatPoints, formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminRewardsPage() {
  const rewards = await db.reward.findMany({
    where: { deletedAt: null },
    orderBy: { pointsCost: "asc" },
    include: { _count: { select: { redemptions: true } } },
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Manage Rewards</h1>
        <p className="text-muted-foreground">{rewards.length} reward items</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rewards.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <div className="flex justify-between gap-2">
                <CardTitle className="text-base">{r.name}</CardTitle>
                <Badge>{r.type.replace("_", " ")}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="text-xl font-bold text-primary">{formatPoints(r.pointsCost)} pts</p>
              {r.cashValue && <p>Value: {formatCurrency(r.cashValue)}</p>}
              <p>Stock: {r.stock}</p>
              <p className="text-muted-foreground">{r._count.redemptions} redemptions</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
