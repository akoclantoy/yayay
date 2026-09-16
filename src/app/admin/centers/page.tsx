import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminCentersPage() {
  const centers = await db.collectionCenter.findMany({
    where: { deletedAt: null },
    include: { barangay: true, _count: { select: { recyclingRecords: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Collection Centers</h1>
        <p className="text-muted-foreground">{centers.length} centers</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {centers.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <div className="flex justify-between">
                <CardTitle className="text-lg">{c.name}</CardTitle>
                <Badge variant={c.isActive ? "success" : "warning"}>
                  {c.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>{c.address}</p>
              {c.barangay && <p className="text-primary">{c.barangay.name}</p>}
              {c.openHours && <p>Hours: {c.openHours}</p>}
              {c.phone && <p>Phone: {c.phone}</p>}
              <p className="text-muted-foreground">{c._count.recyclingRecords} records</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
