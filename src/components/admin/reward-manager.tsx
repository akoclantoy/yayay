"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatCurrency, pointsToCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RewardType = "VOUCHER" | "CASH" | "GIFT" | "DISCOUNT" | "BARANGAY_INCENTIVE";

type Reward = {
  id: string;
  name: string;
  description: string | null;
  type: RewardType;
  pointsCost: number;
  cashValue: number | null;
  imageUrl: string | null;
  stock: number;
  redemptions: number;
};

type FormState = {
  name: string;
  description: string;
  type: RewardType;
  pointsCost: string;
  stock: string;
  imageData: string | null;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  type: "VOUCHER",
  pointsCost: "",
  stock: "0",
  imageData: null,
};

const TYPE_LABELS: Record<RewardType, string> = {
  VOUCHER: "Voucher",
  CASH: "Cash",
  GIFT: "Gift",
  DISCOUNT: "Discount",
  BARANGAY_INCENTIVE: "Barangay incentive",
};

function toForm(reward: Reward): FormState {
  return {
    name: reward.name,
    description: reward.description ?? "",
    type: reward.type,
    pointsCost: String(reward.pointsCost),
    stock: String(reward.stock),
    imageData: null,
  };
}

export function RewardManager({ initial }: { initial: Reward[] }) {
  const [rewards, setRewards] = useState(initial);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateForm(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEdit(reward: Reward) {
    setEditingId(reward.id);
    setForm(toForm(reward));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function chooseImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    const imageData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setForm((current) => ({ ...current, imageData }));
  }

  async function saveReward(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...(editingId ? { id: editingId } : {}),
        name: form.name,
        description: form.description || null,
        type: form.type,
        pointsCost: Number(form.pointsCost),
        stock: Number(form.stock),
        imageData: form.imageData,
      };
      const response = await fetch("/api/admin/rewards", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save reward");

      const saved: Reward = { ...data, redemptions: editingId ? rewards.find((r) => r.id === editingId)?.redemptions ?? 0 : 0 };
      setRewards((current) => editingId ? current.map((reward) => reward.id === saved.id ? saved : reward) : [saved, ...current]);
      resetForm();
      toast.success(data.warning ?? (editingId ? "Reward updated" : "Reward created"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save reward");
    } finally {
      setSaving(false);
    }
  }

  async function deleteReward(id: string) {
    if (!window.confirm("Delete this reward? Existing redemption records will be kept.")) return;
    const response = await fetch("/api/admin/rewards", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error ?? "Unable to delete reward");
      return;
    }
    setRewards((current) => current.filter((reward) => reward.id !== id));
    if (editingId === id) resetForm();
    toast.success("Reward deleted");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>{editingId ? "Update reward" : "Create reward"}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveReward} className="grid gap-4 sm:grid-cols-2">
            <Input required placeholder="Reward name" value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
            <select className="flex h-11 w-full rounded-xl border border-border/80 bg-white/80 px-4 text-sm dark:bg-white/5" value={form.type} onChange={(event) => updateForm("type", event.target.value)}>
              {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <Input required type="number" min="1" step="1" placeholder="Points cost" value={form.pointsCost} onChange={(event) => updateForm("pointsCost", event.target.value)} />
            <Input required type="number" min="0" step="1" placeholder="Stock" value={form.stock} onChange={(event) => updateForm("stock", event.target.value)} />
            <Input
              type="text"
              readOnly
              value={form.pointsCost ? formatCurrency(pointsToCurrency(Number(form.pointsCost))) : ""}
              placeholder="Cash value calculated from points"
              aria-label="Automatically calculated cash value"
            />
            <Input type="file" accept="image/*" onChange={(event) => void chooseImage(event.target.files?.[0])} />
            <textarea className="min-h-24 rounded-xl border border-border/80 bg-white/80 px-4 py-3 text-sm sm:col-span-2 dark:bg-white/5" placeholder="Description (optional)" value={form.description} onChange={(event) => updateForm("description", event.target.value)} />
            {form.imageData && <img src={form.imageData} alt="Selected reward preview" className="h-24 w-24 rounded-lg object-cover" />}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : editingId ? "Update reward" : "Create reward"}</Button>
              {editingId && <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rewards.map((reward) => (
          <Card key={reward.id}>
            <CardContent className="space-y-3 pt-6">
              {reward.imageUrl && <img src={reward.imageUrl} alt="" className="h-36 w-full rounded-lg object-cover" />}
              <div>
                <h2 className="font-semibold">{reward.name}</h2>
                <p className="text-sm text-muted-foreground">{TYPE_LABELS[reward.type]}</p>
              </div>
              <p className="font-bold text-primary">{reward.pointsCost} pts</p>
              <p className="text-sm">Stock: {reward.stock} · {reward.redemptions} redemptions</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(reward)}>Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => void deleteReward(reward.id)}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}