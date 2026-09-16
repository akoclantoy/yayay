import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { ScanLine, ClipboardList, Truck, Recycle } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DashboardPageHeader,
  FadeInSection,
  HoverLiftCard,
  StaggerGrid,
  StaggerItem,
} from "@/components/dashboard/dashboard-motion";

export default async function StaffDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [todayRecords, pendingPickups] = await Promise.all([
    db.recyclingRecord.count({
      where: {
        recordedById: session.user.id,
        collectionDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        deletedAt: null,
      },
    }),
    db.pickupRequest.count({
      where: { status: "PENDING", deletedAt: null },
    }),
  ]);

  const actions = [
    { href: "/staff/scan", label: "Scan QR Code", icon: ScanLine, desc: "Verify resident" },
    { href: "/staff/record", label: "Record Recycling", icon: ClipboardList, desc: "Log collection" },
    { href: "/staff/pickups", label: "Manage Pickups", icon: Truck, desc: `${pendingPickups} pending` },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <DashboardPageHeader
        title="Staff Dashboard"
        subtitle="Collection operations center"
      />

      <StaggerGrid className="grid sm:grid-cols-3 gap-4">
        <StaggerItem>
          <HoverLiftCard>
            <Card className="h-full">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Today&apos;s records</p>
                <p className="text-3xl font-bold mt-1">{todayRecords}</p>
              </CardContent>
            </Card>
          </HoverLiftCard>
        </StaggerItem>
        <StaggerItem>
          <HoverLiftCard>
            <Card className="h-full">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Pending pickups</p>
                <p className="text-3xl font-bold mt-1">{pendingPickups}</p>
              </CardContent>
            </Card>
          </HoverLiftCard>
        </StaggerItem>
        <StaggerItem>
          <HoverLiftCard>
            <Card className="h-full">
              <CardContent className="pt-6 flex items-center gap-3">
                <Recycle className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium">Ready to collect</p>
                  <p className="text-sm text-muted-foreground">Scan or record below</p>
                </div>
              </CardContent>
            </Card>
          </HoverLiftCard>
        </StaggerItem>
      </StaggerGrid>

      <FadeInSection className="grid sm:grid-cols-3 gap-4" delay={0.14}>
        {actions.map((a) => (
          <Link key={a.href} href={a.href}>
            <HoverLiftCard>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <a.icon className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">{a.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{a.desc}</p>
                  <Button variant="outline" size="sm" className="mt-4">
                    Open
                  </Button>
                </CardContent>
              </Card>
            </HoverLiftCard>
          </Link>
        ))}
      </FadeInSection>
    </div>
  );
}
