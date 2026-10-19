import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarangayImpactMap } from "@/components/admin/barangay-impact-map";
import { formatPoints, formatWeight } from "@/lib/utils";
import { getTupiBarangayActivity } from "@/lib/tupi-activity";

export default async function AdminBarangaysPage() {
  const barangays = await getTupiBarangayActivity();
  const mostActive = [...barangays].sort((a, b) => b.recycledKg - a.recycledKg)[0];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tupi barangays</h1>
        <p className="mt-1 text-muted-foreground">
          Explore resident participation and recycling activity across Tupi, South Cotabato.
        </p>
      </div>

      {mostActive && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">Tupi barangays</p><p className="mt-1 text-2xl font-bold">{barangays.length}</p></CardContent></Card>
          <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">Registered residents</p><p className="mt-1 text-2xl font-bold">{formatPoints(barangays.reduce((total, item) => total + item.residents, 0))}</p></CardContent></Card>
          <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">Most active by recycled weight</p><p className="mt-1 text-2xl font-bold">{mostActive.name}</p><p className="text-sm text-primary">{formatWeight(mostActive.recycledKg)} recycled</p></CardContent></Card>
        </div>
      )}

      <BarangayImpactMap barangays={barangays} />

      <div className="grid gap-4 md:grid-cols-2">
        {barangays.map((b) => (
          <Card key={b.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle>{b.name}</CardTitle>
                <Badge variant={b.residents > 0 ? "success" : "secondary"}>
                  {b.residents > 0 ? "Active" : "Awaiting residents"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground font-mono">{b.code}</p>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              {b.address && <p>{b.address}</p>}
              <p>{formatPoints(b.residents)} residents · {formatPoints(b.centers)} centers</p>
              <p>{formatWeight(b.recycledKg)} recycled · {formatPoints(b.collections)} collections</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
