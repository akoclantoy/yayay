import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatPoints, formatWeight } from "@/lib/utils";
import {
  Wallet,
  Recycle,
  Leaf,
  Flame,
  ArrowRight,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  DashboardPageHeader,
  FadeInSection,
  HoverLiftCard,
  StaggerGrid,
  StaggerItem,
} from "@/components/dashboard/dashboard-motion";

export default async function ResidentDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const [profile, wallet, recentRecords, announcements] = await Promise.all([
    db.residentProfile.findUnique({
      where: { userId },
      include: { barangay: true },
    }),
    db.rewardWallet.findUnique({ where: { residentId: userId } }),
    db.recyclingRecord.findMany({
      where: { residentId: userId, deletedAt: null },
      orderBy: { collectionDate: "desc" },
      take: 5,
      include: { wasteCategory: true },
    }),
    db.announcement.findMany({
      where: { deletedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: 3,
    }),
  ]);

  const balance = wallet?.balance ?? 0;
  const streak = profile?.recyclingStreak ?? 0;
  const totalWeight = profile?.totalWeightKg ?? 0;
  const carbonSaved = profile?.carbonSavedKg ?? 0;
  const envScore = profile?.environmentalScore ?? 0;

  const stats = [
    {
      label: "Reward balance",
      value: formatPoints(balance),
      sub: "points available",
      icon: Wallet,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Total recycled",
      value: formatWeight(totalWeight),
      sub: "lifetime",
      icon: Recycle,
      color: "text-secondary",
      bg: "bg-secondary/10",
    },
    {
      label: "Carbon saved",
      value: formatWeight(carbonSaved),
      sub: "CO₂ equivalent",
      icon: Leaf,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      label: "Recycling streak",
      value: `${streak} days`,
      sub: "keep it going!",
      icon: Flame,
      color: "text-warning",
      bg: "bg-warning/10",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <DashboardPageHeader
        title={`Welcome back, ${session.user.name?.split(" ")[0] ?? "Resident"}`}
        subtitle={`${profile?.barangay?.name ? `${profile.barangay.name} · ` : ""}Track your recycling impact and rewards`}
      />

      <StaggerGrid className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StaggerItem key={stat.label}>
            <HoverLiftCard>
              <Card className="hover:shadow-lg transition-shadow h-full">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
                    </div>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </HoverLiftCard>
          </StaggerItem>
        ))}
      </StaggerGrid>

      <FadeInSection className="grid lg:grid-cols-3 gap-6" delay={0.16}>
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent recycling</CardTitle>
            <Link href="/resident/history">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentRecords.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Recycle className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No recycling records yet.</p>
                <Link href="/resident/centers">
                  <Button variant="outline" size="sm" className="mt-4">
                    Find a collection center
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentRecords.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between rounded-xl border border-border/50 p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{record.wasteCategory.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatWeight(record.weightKg)} ·{" "}
                        {new Date(record.collectionDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="secondary">+{record.pointsEarned} pts</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Environmental score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-4">
                <p className="text-4xl font-bold text-gradient">{envScore}</p>
                <p className="text-sm text-muted-foreground">out of 1000</p>
              </div>
              <Progress value={Math.min(envScore / 10, 100)} className="h-3" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Trophy className="h-4 w-4 text-warning" />
              <CardTitle className="text-base">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/resident/qr-card" className="block">
                <Button variant="outline" className="w-full justify-start">
                  Show QR card
                </Button>
              </Link>
              <Link href="/resident/pickup" className="block">
                <Button variant="outline" className="w-full justify-start">
                  Request pickup
                </Button>
              </Link>
              <Link href="/resident/assistant" className="block">
                <Button variant="outline" className="w-full justify-start">
                  Ask AI assistant
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </FadeInSection>

      {announcements.length > 0 && (
        <FadeInSection delay={0.22}>
        <Card>
          <CardHeader>
            <CardTitle>Announcements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {announcements.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-border/50 p-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  {a.isPinned && <Badge>Pinned</Badge>}
                  <p className="font-medium">{a.title}</p>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {a.content}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
        </FadeInSection>
      )}
    </div>
  );
}
