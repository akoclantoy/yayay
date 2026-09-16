import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Phone, Clock } from "lucide-react";

export default async function CentersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await db.residentProfile.findUnique({
    where: { userId: session.user.id },
    include: { barangay: true },
  });

  const centers = await db.collectionCenter.findMany({
    where: { isActive: true, deletedAt: null },
    include: { barangay: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Nearby Collection Centers</h1>
        <p className="text-muted-foreground">
          {profile?.barangay
            ? `Centers serving ${profile.barangay.name} and nearby areas`
            : "Find a center near you"}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {centers.map((center) => (
          <Card key={center.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                {center.name}
              </CardTitle>
              {center.barangay && (
                <p className="text-sm text-primary">{center.barangay.name}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">{center.address}</p>
              {center.openHours && (
                <p className="flex items-center gap-2">
                  <Clock className="h-4 w-4" /> {center.openHours}
                </p>
              )}
              {center.phone && (
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4" /> {center.phone}
                </p>
              )}
              {center.capacityKg && (
                <p className="text-xs text-muted-foreground">
                  Capacity: {center.capacityKg.toLocaleString()} kg
                </p>
              )}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${center.latitude},${center.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-primary text-sm font-medium hover:underline mt-2"
              >
                Open in Google Maps →
              </a>
            </CardContent>
          </Card>
        ))}
      </div>

      {centers.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No collection centers available yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
