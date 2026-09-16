"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function PickupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [wasteNotes, setWasteNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          wasteNotes,
          scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed");
      }
      toast.success("Pickup request submitted!");
      router.refresh();
      setAddress("");
      setScheduledDate("");
      setWasteNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Request Pickup</h1>
        <p className="text-muted-foreground">
          Schedule a home collection for your recyclable materials
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pickup details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="address">Pickup address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House no., street, barangay"
                required
              />
            </div>
            <div>
              <Label htmlFor="date">Preferred date (optional)</Label>
              <Input
                id="date"
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="notes">Waste description</Label>
              <Textarea
                id="notes"
                value={wasteNotes}
                onChange={(e) => setWasteNotes(e.target.value)}
                placeholder="e.g. 5kg plastic bottles, 3kg cardboard..."
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Submitting..." : "Submit pickup request"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
