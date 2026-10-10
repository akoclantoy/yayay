"use client";

import { useState } from "react";
import { Award, Gift, Pencil, Sparkles, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BadgeItem = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  criteria: string | null;
  points: number;
  awards: number;
};

type ResidentOption = { id: string; name: string; email: string };

type BadgeForm = {
  name: string;
  description: string;
  icon: string;
  criteria: string;
  points: string;
};

const EMPTY_FORM: BadgeForm = {
  name: "",
  description: "",
  icon: "🏅",
  criteria: "",
  points: "0",
};

export function BadgeManager({
  initialBadges,
  residents,
}: {
  initialBadges: BadgeItem[];
  residents: ResidentOption[];
}) {
  const [badges, setBadges] = useState(initialBadges);
  const [form, setForm] = useState<BadgeForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedBadge, setSelectedBadge] = useState("");
  const [selectedResident, setSelectedResident] = useState("");
  const [saving, setSaving] = useState(false);
  const [awarding, setAwarding] = useState(false);

  function editBadge(badge: BadgeItem) {
    setEditingId(badge.id);
    setForm({
      name: badge.name,
      description: badge.description ?? "",
      icon: badge.icon ?? "🏅",
      criteria: badge.criteria ?? "",
      points: String(badge.points),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function saveBadge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/badges", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          name: form.name,
          description: form.description || null,
          icon: form.icon || null,
          criteria: form.criteria || null,
          points: Number(form.points),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save badge");
      const badge: BadgeItem = {
        id: data.id,
        name: data.name,
        description: data.description,
        icon: data.icon,
        criteria: data.criteria,
        points: data.points,
        awards: data._count.userBadges,
      };
      setBadges((current) => editingId
        ? current.map((item) => item.id === badge.id ? badge : item)
        : [...current, badge].sort((a, b) => a.name.localeCompare(b.name)));
      resetForm();
      toast.success(editingId ? "Badge updated" : "Badge created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save badge");
    } finally {
      setSaving(false);
    }
  }

  async function awardBadge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAwarding(true);
    try {
      const response = await fetch("/api/admin/badges/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badgeId: selectedBadge, userId: selectedResident }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to award badge");
      setBadges((current) => current.map((badge) => badge.id === selectedBadge
        ? { ...badge, awards: badge.awards + 1 }
        : badge));
      toast.success("Badge awarded to resident");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to award badge");
    } finally {
      setAwarding(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden border-emerald-900/10 bg-[linear-gradient(125deg,rgba(16,92,67,0.08),rgba(232,184,76,0.12)_58%,rgba(255,255,255,0.75))]">
          <CardContent className="flex min-h-44 flex-col justify-between gap-6 p-6 sm:flex-row sm:items-end sm:p-8">
            <div className="max-w-xl">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <Sparkles className="h-4 w-4" /> Recognition that rewards action
              </div>
              <h2 className="text-2xl font-semibold tracking-normal text-foreground">Badges & bonus points</h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                Create milestone badges, assign them to residents, and let each resident claim its bonus once.
              </p>
            </div>
            <div className="flex gap-6 text-sm">
              <div><p className="text-2xl font-semibold">{badges.length}</p><p className="text-muted-foreground">badge types</p></div>
              <div><p className="text-2xl font-semibold">{badges.reduce((total, badge) => total + badge.awards, 0)}</p><p className="text-muted-foreground">awarded</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4 text-primary" /> Award a badge</CardTitle></CardHeader>
          <CardContent>
            {residents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active residents are available.</p>
            ) : (
              <form onSubmit={awardBadge} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="award-badge">Badge</Label>
                  <select id="award-badge" required value={selectedBadge} onChange={(event) => setSelectedBadge(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
                    <option value="">Choose a badge</option>
                    {badges.map((badge) => <option key={badge.id} value={badge.id}>{badge.icon ?? "🏅"} {badge.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="award-resident">Resident</Label>
                  <select id="award-resident" required value={selectedResident} onChange={(event) => setSelectedResident(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
                    <option value="">Choose a resident</option>
                    {residents.map((resident) => <option key={resident.id} value={resident.id}>{resident.name} · {resident.email}</option>)}
                  </select>
                </div>
                <Button type="submit" className="w-full" disabled={awarding || badges.length === 0 || !selectedBadge || !selectedResident}>
                  <Award /> {awarding ? "Awarding..." : "Award badge"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="h-fit">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Gift className="h-4 w-4 text-primary" /> {editingId ? "Edit badge" : "Create a badge"}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={saveBadge} className="space-y-4">
              <div className="grid grid-cols-[5rem_1fr] gap-3">
                <div className="space-y-1.5"><Label htmlFor="badge-icon">Icon</Label><Input id="badge-icon" value={form.icon} maxLength={12} onChange={(event) => setForm({ ...form, icon: event.target.value })} className="text-center text-xl" /></div>
                <div className="space-y-1.5"><Label htmlFor="badge-name">Badge name</Label><Input id="badge-name" required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Neighborhood Guardian" /></div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="badge-description">Description</Label><textarea id="badge-description" maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What did the resident accomplish?" className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></div>
              <div className="space-y-1.5"><Label htmlFor="badge-criteria">Milestone</Label><Input id="badge-criteria" maxLength={500} value={form.criteria} onChange={(event) => setForm({ ...form, criteria: event.target.value })} placeholder="e.g. Recycled 25 kg this month" /></div>
              <div className="space-y-1.5"><Label htmlFor="badge-points">Claimable bonus</Label><div className="relative"><Input id="badge-points" type="number" min="0" max="100000" step="1" required value={form.points} onChange={(event) => setForm({ ...form, points: event.target.value })} className="pr-14" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">points</span></div></div>
              <div className="flex gap-2"><Button type="submit" disabled={saving}>{saving ? "Saving..." : editingId ? "Save badge" : "Create badge"}</Button>{editingId && <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>}</div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex items-end justify-between"><div><h2 className="text-lg font-semibold">Badge catalog</h2><p className="text-sm text-muted-foreground">Edit badge details or bonus values at any time.</p></div></div>
          {badges.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Create the first badge to start recognizing residents.</CardContent></Card>
          ) : badges.map((badge) => (
            <Card key={badge.id}>
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-700/10 text-2xl">{badge.icon ?? "🏅"}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{badge.name}</h3><Badge variant="secondary">{badge.awards} awarded</Badge></div>
                  <p className="mt-1 text-sm text-muted-foreground">{badge.description || badge.criteria || "No description added"}</p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <p className="whitespace-nowrap text-sm font-semibold text-emerald-800">{badge.points.toLocaleString()} pts</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => editBadge(badge)} aria-label={`Edit ${badge.name}`}><Pencil /> Edit</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}