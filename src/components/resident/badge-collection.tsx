"use client";

import { useState } from "react";
import { Award, Check, Gift, LockKeyhole, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type BadgeEntry = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  criteria: string | null;
  points: number;
  earnedAt: string | null;
  claimedAt: string | null;
};

export function BadgeCollection({ initialBadges }: { initialBadges: BadgeEntry[] }) {
  const [badges, setBadges] = useState(initialBadges);
  const [claiming, setClaiming] = useState<string | null>(null);
  const earnedCount = badges.filter((badge) => badge.earnedAt).length;
  const claimablePoints = badges.reduce((total, badge) =>
    total + (badge.earnedAt && !badge.claimedAt ? badge.points : 0), 0);

  async function claimBonus(badgeId: string) {
    setClaiming(badgeId);
    try {
      const response = await fetch("/api/badges/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badgeId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to claim bonus");
      setBadges((current) => current.map((badge) => badge.id === badgeId
        ? { ...badge, claimedAt: new Date().toISOString() }
        : badge));
      toast.success(`${data.points} points added to your wallet`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to claim bonus");
    } finally {
      setClaiming(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header className="relative overflow-hidden rounded-2xl border border-emerald-950/10 bg-[linear-gradient(115deg,#e7f2e8_0%,#f4ead0_55%,#e4efec_100%)] p-6 sm:p-8">
        <div className="relative z-10 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="max-w-xl">
            <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-900"><Sparkles className="h-4 w-4" /> Your milestones</p>
            <h1 className="text-3xl font-semibold text-emerald-950">Badges & achievements</h1>
            <p className="mt-2 text-sm leading-6 text-emerald-950/70">Every badge marks a positive change for your community. Claim earned bonus points straight to your wallet.</p>
          </div>
          <div className="flex gap-6 rounded-xl border border-white/70 bg-white/60 px-5 py-4 backdrop-blur-sm">
            <div><p className="text-2xl font-semibold text-emerald-950">{earnedCount}<span className="text-base text-emerald-950/50">/{badges.length}</span></p><p className="text-xs text-emerald-950/65">earned</p></div>
            <div className="border-l border-emerald-950/15 pl-6"><p className="text-2xl font-semibold text-emerald-950">{claimablePoints.toLocaleString()}</p><p className="text-xs text-emerald-950/65">points to claim</p></div>
          </div>
        </div>
      </header>

      {badges.length === 0 ? (
        <Card><CardContent className="py-14 text-center"><Award className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" /><p className="font-medium">No badges are available yet</p><p className="mt-1 text-sm text-muted-foreground">Your next milestone will appear here.</p></CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {badges.map((badge) => {
            const earned = Boolean(badge.earnedAt);
            const claimed = Boolean(badge.claimedAt);
            return (
              <Card key={badge.id} className={`overflow-hidden transition-colors ${earned ? "border-emerald-800/20" : "opacity-75"}`}>
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl ${earned ? "bg-emerald-700/10" : "bg-muted grayscale"}`}>{badge.icon ?? "🏅"}</div>
                    {earned ? <Badge variant="success">Earned</Badge> : <LockKeyhole className="mt-1 h-4 w-4 text-muted-foreground" aria-label="Not yet earned" />}
                  </div>
                  <h2 className="mt-4 font-semibold">{badge.name}</h2>
                  <p className="mt-1 min-h-10 text-sm leading-5 text-muted-foreground">{badge.description || badge.criteria || "A milestone in your recycling journey."}</p>
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800"><Gift className="h-4 w-4" />{badge.points.toLocaleString()} pts</div>
                    {claimed ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Check className="h-4 w-4 text-emerald-700" /> Claimed</span>
                    ) : earned && badge.points > 0 ? (
                      <Button size="sm" onClick={() => void claimBonus(badge.id)} disabled={claiming === badge.id}>
                        {claiming === badge.id ? "Claiming..." : "Claim bonus"}
                      </Button>
                    ) : earned ? (
                      <span className="text-xs text-muted-foreground">No points bonus</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not earned yet</span>
                    )}
                  </div>
                  {earned && <p className="mt-3 text-xs text-muted-foreground">Earned {new Date(badge.earnedAt!).toLocaleDateString()}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}