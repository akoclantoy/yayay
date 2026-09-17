import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WastePointsManager } from "@/components/admin/waste-points-manager";

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
          <WastePointsManager initial={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
