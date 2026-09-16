"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, ScanLine } from "lucide-react";

type Category = { id: string; name: string; pointsPerKg: number; type: string };

function RecordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [aiResult, setAiResult] = useState<{ typeLabel?: string; confidence?: number; tips?: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
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

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      toast.error("Unable to open the camera. Check browser permission and use HTTPS.");
    }
  }

  async function identifyWaste() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      toast.error("Start the camera and point it at the waste first.");
      return;
    }

    setIdentifying(true);
    try {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1280 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL("image/jpeg", 0.82);

      const response = await fetch("/api/ai/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData, description: "Identify this waste item for recycling." }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "AI identification failed");

      const category = categories.find((item) => item.type === data.type);
      if (category) {
        setForm((current) => ({ ...current, wasteCategoryId: category.id }));
      }
      setAiResult(data);
      toast.success(category ? `Identified as ${data.typeLabel}` : "Waste identified; choose the matching category.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI identification failed");
    } finally {
      setIdentifying(false);
    }
  }

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
            <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium flex items-center gap-2"><Camera className="h-4 w-4" /> AI Camera Identifier</p>
                  <p className="text-xs text-muted-foreground">Identify the trash type with the device camera.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={cameraActive ? stopCamera : startCamera}>
                  {cameraActive ? "Stop camera" : "Open camera"}
                </Button>
              </div>
              {cameraActive && (
                <>
                  <video ref={videoRef} muted playsInline className="aspect-video w-full rounded-lg bg-black object-cover" />
                  <Button type="button" className="w-full" onClick={identifyWaste} disabled={identifying}>
                    <ScanLine className="mr-2 h-4 w-4" />
                    {identifying ? "Identifying..." : "Identify trash"}
                  </Button>
                </>
              )}
              {aiResult && (
                <p className="text-sm text-muted-foreground">
                  AI result: <span className="font-medium text-foreground">{aiResult.typeLabel ?? "Unknown"}</span>
                  {typeof aiResult.confidence === "number" && ` · ${Math.round(aiResult.confidence * 100)}% confidence`}
                </p>
              )}
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
