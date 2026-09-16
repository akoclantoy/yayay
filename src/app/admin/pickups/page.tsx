import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminPickupsPage() {
  const pickups = await db.pickupRequest.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      assignedStaff: { select: { name: true } },
    },
  });

  const pending = pickups.filter((p) => p.status === "PENDING").length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Pickup Requests</h1>
        <p className="text-muted-foreground">
          {pickups.length} total · {pending} pending review
        </p>
      </div>

      {pickups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No pickup requests yet
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pickups.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-4">
                  <CardTitle className="text-base">
                    {p.user.name ?? p.user.email}
                  </CardTitle>
                  <Badge>{p.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>{p.address}</p>
                {p.wasteNotes && (
                  <p className="text-muted-foreground">{p.wasteNotes}</p>
                )}
                {p.assignedStaff && (
                  <p>Assigned: {p.assignedStaff.name}</p>
                )}
                {p.scheduledDate && (
                  <p>Scheduled: {p.scheduledDate.toLocaleString()}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Requested {p.createdAt.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
