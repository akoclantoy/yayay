import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Truck } from "lucide-react";
import Link from "next/link";

export default async function SchedulePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [profile, pickups] = await Promise.all([
    db.residentProfile.findUnique({
      where: { userId: session.user.id },
    }),
    db.pickupRequest.findMany({
      where: { userId: session.user.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        assignedStaff: { select: { name: true } },
      },
    }),
  ]);

  const schedules = await db.collectionSchedule.findMany({
    where: profile?.barangayId
      ? { OR: [{ barangayId: profile.barangayId }, { barangayId: null }] }
      : {},
    orderBy: { startDate: "asc" },
    include: { barangay: true, center: true },
    take: 20,
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Schedule</h1>
        <p className="text-muted-foreground">
          View your pickup request history and upcoming community collections
        </p>
      </div>

      <section className="space-y-3" aria-labelledby="pickup-requests-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="pickup-requests-heading" className="text-xl font-semibold">
              My pickup requests
            </h2>
            <p className="text-sm text-muted-foreground">
              {pickups.length} {pickups.length === 1 ? "request" : "requests"}
            </p>
          </div>
          <Link href="/resident/pickup">
            <Button variant="outline" size="sm">
              <Truck className="h-4 w-4" />
              Request a pickup
            </Button>
          </Link>
        </div>

        {pickups.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <Truck className="mx-auto mb-3 h-8 w-8 opacity-50" />
              <p>You haven&apos;t requested a pickup yet.</p>
              <Link href="/resident/pickup">
                <Button className="mt-4" size="sm">
                  Request your first pickup
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pickups.map((pickup) => {
              const statusLabel = pickup.status
                .toLowerCase()
                .replaceAll("_", " ")
                .replace(/\b\w/g, (letter) => letter.toUpperCase());
              const statusVariant =
                pickup.status === "CANCELLED"
                  ? "outline"
                  : pickup.status === "PENDING"
                    ? "warning"
                    : "success";

              return (
                <Card key={pickup.id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <CardTitle className="flex items-start gap-2 text-base">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {pickup.address}
                      </CardTitle>
                      <Badge variant={statusVariant}>{statusLabel}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                      <div>
                        <dt className="font-medium">Preferred pickup</dt>
                        <dd className="text-muted-foreground">
                          {pickup.scheduledDate
                            ? pickup.scheduledDate.toLocaleString()
                            : "No preferred date"}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium">Assigned staff</dt>
                        <dd className="text-muted-foreground">
                          {pickup.assignedStaff?.name ?? "Not assigned"}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium">Request submitted</dt>
                        <dd className="text-muted-foreground">
                          {pickup.createdAt.toLocaleString()}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium">Last updated</dt>
                        <dd className="text-muted-foreground">
                          {pickup.updatedAt.toLocaleString()}
                        </dd>
                      </div>
                      {pickup.collectedAt && (
                        <div>
                          <dt className="font-medium">Collected</dt>
                          <dd className="text-muted-foreground">
                            {pickup.collectedAt.toLocaleString()}
                          </dd>
                        </div>
                      )}
                    </dl>

                    <div className="border-t border-border/60 pt-3">
                      <p className="font-medium">Waste description</p>
                      <p className="whitespace-pre-wrap text-muted-foreground">
                        {pickup.wasteNotes || "No waste description provided"}
                      </p>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Request ID: {pickup.id}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section
        className="space-y-3"
        aria-labelledby="collection-schedule-heading"
      >
        <div>
          <h2 id="collection-schedule-heading" className="text-xl font-semibold">
            Community collection schedule
          </h2>
          <p className="text-sm text-muted-foreground">
            Upcoming collection dates and events
          </p>
        </div>

        {schedules.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No scheduled collections yet. Check back for updates.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {schedules.map((s) => (
              <Card key={s.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="h-5 w-5 text-primary" />
                    {s.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">Start:</span>{" "}
                    {s.startDate.toLocaleString()}
                  </p>
                  {s.endDate && (
                    <p>
                      <span className="font-medium">End:</span>{" "}
                      {s.endDate.toLocaleString()}
                    </p>
                  )}
                  {s.recurrence && (
                    <p className="text-muted-foreground">
                      Repeats: {s.recurrence}
                    </p>
                  )}
                  {s.barangay && <p>Barangay: {s.barangay.name}</p>}
                  {s.center && <p>Center: {s.center.name}</p>}
                  {s.notes && (
                    <p className="mt-2 text-muted-foreground">{s.notes}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
