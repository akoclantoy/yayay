import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatPoints, formatWeight } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const records = await db.recyclingRecord.findMany({
    where: { residentId: session.user.id, deletedAt: null },
    orderBy: { collectionDate: "desc" },
    include: {
      wasteCategory: true,
      center: true,
      recordedBy: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Collection History</h1>
        <p className="text-muted-foreground">All your verified recycling records</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{records.length} records</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              No collection records yet.
            </p>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/50 p-4"
                >
                  <div>
                    <p className="font-medium">{record.wasteCategory.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatWeight(record.weightKg)} · Qty {record.quantity}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(record.collectionDate).toLocaleString()}
                      {record.center && ` · ${record.center.name}`}
                      {record.recordedBy?.name && ` · Verified by ${record.recordedBy.name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {record.verified && <Badge variant="success">Verified</Badge>}
                    <Badge variant="secondary">+{formatPoints(record.pointsEarned)} pts</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
