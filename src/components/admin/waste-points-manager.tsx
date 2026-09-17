"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Category = { id: string; name: string; type: string; pointsPerKg: number; carbonFactorKg: number };

export function WastePointsManager({ initial }: { initial: Category[] }) {
  const [categories, setCategories] = useState(initial);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function updatePoints(category: Category, value: string) {
    const pointsPerKg = Number(value);
    if (!Number.isFinite(pointsPerKg) || pointsPerKg <= 0) {
      toast.error("Points per kg must be greater than zero.");
      return;
    }
    setSavingId(category.id);
    try {
      const response = await fetch("/api/admin/waste", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: category.id, pointsPerKg }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to update points");
      setCategories((current) => current.map((item) => item.id === category.id ? { ...item, pointsPerKg: data.pointsPerKg } : item));
      toast.success(`${category.name} points updated`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update points");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-2">
      {categories.map((category) => (
        <div key={category.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
          <div>
            <p className="font-medium">{category.name}</p>
            <p className="text-sm text-muted-foreground">{category.type} · {category.carbonFactorKg} kg CO₂/kg</p>
          </div>
          <form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); const input = event.currentTarget.elements.namedItem("pointsPerKg") as HTMLInputElement; void updatePoints(category, input.value); }}>
            <Input name="pointsPerKg" type="number" min="0.01" step="0.01" defaultValue={category.pointsPerKg} className="w-28" aria-label={`${category.name} points per kg`} />
            <span className="text-sm text-muted-foreground">pts/kg</span>
            <Button type="submit" size="sm" disabled={savingId === category.id}>{savingId === category.id ? "Saving..." : "Save"}</Button>
          </form>
        </div>
      ))}
    </div>
  );
}