import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";

export default async function RoutesPage() {
  const routes = await db.pickupRoute.findMany({
    where: { isActive: true },
    orderBy: { routeDate: "desc" },
    include: {
      barangay: true,
      center: true,
      staff: { include: { user: { select: { name: true } } } },
    },
    take: 20,
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Assigned Routes</h1>
        <p className="text-muted-foreground">Your collection routes and schedules</p>
      </div>

      {routes.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No routes assigned</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {routes.map((route) => (
            <Card key={route.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  {route.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p>Date: {new Date(route.routeDate).toLocaleDateString()}</p>
                {route.barangay && <p>Barangay: {route.barangay.name}</p>}
                {route.center && <p>Center: {route.center.name}</p>}
                {route.staff?.user?.name && <p>Staff: {route.staff.user.name}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
