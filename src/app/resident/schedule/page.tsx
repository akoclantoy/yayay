import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export default async function SchedulePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await db.residentProfile.findUnique({
    where: { userId: session.user.id },
  });

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
        <h1 className="text-2xl font-bold">Collection Schedule</h1>
        <p className="text-muted-foreground">Upcoming collection dates and events</p>
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
              <CardContent className="text-sm space-y-1">
                <p>
                  <span className="font-medium">Start:</span>{" "}
                  {new Date(s.startDate).toLocaleString()}
                </p>
                {s.endDate && (
                  <p>
                    <span className="font-medium">End:</span>{" "}
                    {new Date(s.endDate).toLocaleString()}
                  </p>
                )}
                {s.recurrence && <p className="text-muted-foreground">Repeats: {s.recurrence}</p>}
                {s.barangay && <p>Barangay: {s.barangay.name}</p>}
                {s.center && <p>Center: {s.center.name}</p>}
                {s.notes && <p className="text-muted-foreground mt-2">{s.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
