import { db } from "@/lib/db";
import { WASTE_TYPE_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminWastePage() {
  const categories = await db.wasteCategory.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Waste Categories</h1>
        <p className="text-muted-foreground">Points and carbon factors per material</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Categories</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border p-4">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{WASTE_TYPE_LABELS[c.type]}</p>
                </div>
                <div className="text-right space-y-1">
                  <Badge variant="secondary">{c.pointsPerKg} pts/kg</Badge>
                  <p className="text-xs text-muted-foreground">{c.carbonFactorKg} kg CO₂/kg</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
