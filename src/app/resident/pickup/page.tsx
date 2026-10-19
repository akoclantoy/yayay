"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PickupLocationPicker } from "@/components/resident/pickup-location-picker";

export default function PickupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [wasteNotes, setWasteNotes] = useState("");
  const [location, setLocation] = useState<[number, number] | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!location) {
      toast.error("Pin your pickup location on the Tupi map first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          wasteNotes,
          scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : undefined,
          latitude: location[0],
          longitude: location[1],
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
      setLocation(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Request Pickup</h1>
        <p className="text-muted-foreground">
          Schedule a home collection for your recyclable materials
        </p>
      </div>

      <PickupLocationPicker value={location} onChange={setLocation} />

      <Card>
        <CardHeader>
          <CardTitle>Pickup details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="address">Street and house address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House number, street, purok"
                required
              />
            </div>
            <div>
              <Label htmlFor="date">Preferred pickup date and time</Label>
              <Input
                id="date"
                type="datetime-local"
                value={scheduledDate}
                min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
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
            <Button type="submit" disabled={loading || !location} className="w-full">
              {loading ? "Submitting..." : "Submit pickup request"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
