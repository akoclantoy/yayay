import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { formatPoints, formatWeight } from "@/lib/utils";
import { Users, Recycle, Wallet, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  DashboardPageHeader,
  FadeInSection,
  HoverLiftCard,
  StaggerGrid,
  StaggerItem,
} from "@/components/dashboard/dashboard-motion";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [residents, records, redemptions, barangays] = await Promise.all([
    db.user.count({ where: { role: "RESIDENT", deletedAt: null } }),
    db.recyclingRecord.aggregate({
      where: { deletedAt: null },
      _sum: { weightKg: true, pointsEarned: true },
    }),
    db.redemptionRequest.count({ where: { status: "PENDING" } }),
    db.barangay.count({ where: { deletedAt: null, isActive: true } }),
  ]);

  const stats = [
    { label: "Total residents", value: formatPoints(residents), icon: Users },
    { label: "Kg recycled", value: formatWeight(records._sum.weightKg ?? 0), icon: Recycle },
    { label: "Points issued", value: formatPoints(records._sum.pointsEarned ?? 0), icon: Wallet },
    { label: "Active barangays", value: String(barangays), icon: Building2 },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <DashboardPageHeader
        title="Admin Dashboard"
        subtitle="Platform overview and analytics"
      />

      <StaggerGrid className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StaggerItem key={s.label}>
            <HoverLiftCard>
              <Card className="h-full">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{s.label}</p>
                      <p className="text-2xl font-bold mt-1">{s.value}</p>
                    </div>
                    <s.icon className="h-8 w-8 text-primary/60" />
                  </div>
                </CardContent>
              </Card>
            </HoverLiftCard>
          </StaggerItem>
        ))}
      </StaggerGrid>

      {redemptions > 0 && (
        <FadeInSection delay={0.18}>
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-6">
            <p className="font-medium">{redemptions} pending redemption requests need review</p>
          </CardContent>
        </Card>
        </FadeInSection>
      )}
    </div>
  );
}
