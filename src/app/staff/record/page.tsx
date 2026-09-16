"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Category = { id: string; name: string; pointsPerKg: number };

function RecordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    residentId: searchParams.get("residentId") ?? "",
    wasteCategoryId: "",
    weightKg: "",
    notes: "",
  });

  useEffect(() => {
    fetch("/api/waste-categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/recycling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          residentId: form.residentId,
          wasteCategoryId: form.wasteCategoryId,
          weightKg: parseFloat(form.weightKg),
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? data.error?.issues?.[0]?.message ?? "Failed to record recycling";
        throw new Error(message);
      }
      toast.success(`Recorded! ${data.pointsEarned} points awarded.`);
      router.push("/staff");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record");
    } finally {
      setLoading(false);
    }
  }

  const selected = categories.find((c) => c.id === form.wasteCategoryId);
  const estimatedPoints = selected && form.weightKg
    ? Math.round(parseFloat(form.weightKg) * selected.pointsPerKg)
    : 0;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Record Recycling</h1>
        <p className="text-muted-foreground">Log a verified collection for a resident</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Collection details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="residentId">Resident ID</Label>
              <Input
                id="residentId"
                value={form.residentId}
                onChange={(e) => setForm({ ...form, residentId: e.target.value })}
                placeholder="From QR scan"
                required
              />
            </div>
            <div>
              <Label htmlFor="category">Waste category</Label>
              <select
                id="category"
                value={form.wasteCategoryId}
                onChange={(e) => setForm({ ...form, wasteCategoryId: e.target.value })}
                className="flex h-11 w-full rounded-xl border border-border/80 bg-white/80 px-4 text-sm dark:bg-white/5"
                required
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.pointsPerKg} pts/kg)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.01"
                min="0.01"
                value={form.weightKg}
                onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
                required
              />
            </div>
            {estimatedPoints > 0 && (
              <p className="text-sm text-primary font-medium">
                Estimated points: {estimatedPoints}
              </p>
            )}
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Recording..." : "Submit record"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RecordPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <RecordForm />
    </Suspense>
  );
}
