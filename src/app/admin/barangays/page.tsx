import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminBarangaysPage() {
  const barangays = await db.barangay.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: { _count: { select: { residents: true, collectionCenters: true } } },
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Manage Barangays</h1>
        <p className="text-muted-foreground">{barangays.length} barangays registered</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {barangays.map((b) => (
          <Card key={b.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle>{b.name}</CardTitle>
                <Badge variant={b.isActive ? "success" : "warning"}>
                  {b.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground font-mono">{b.code}</p>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              {b.address && <p>{b.address}</p>}
              <p>{b._count.residents} residents · {b._count.collectionCenters} centers</p>
              {b.population && <p>Population: {b.population.toLocaleString()}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
