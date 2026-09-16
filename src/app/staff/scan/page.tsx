"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, ScanLine, Upload, UserCheck } from "lucide-react";
import { formatPoints, getInitials } from "@/lib/utils";
import Link from "next/link";

type ResidentInfo = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  qrCode: string;
  barangay: string | null;
  balance: number;
  totalWeightKg: number;
  environmentalScore: number;
};

export default function ScanPage() {
  const [qr, setQr] = useState("");
  const [loading, setLoading] = useState(false);
  const [resident, setResident] = useState<ResidentInfo | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      void stopCamera();
    };
  }, [previewUrl]);

  async function lookupResident(valueOverride?: string) {
    const value = (valueOverride ?? qr).trim();
    if (!value) return;
    setLoading(true);
    setResident(null);
    try {
      const res = await fetch(`/api/residents/lookup?qr=${encodeURIComponent(value)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Not found");
      setResident(data);
      toast.success("Resident verified!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    await lookupResident(qr);
  }

  async function stopCamera() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        // Ignore cleanup errors.
      }
      try {
        await scannerRef.current.clear();
      } catch {
        // Ignore cleanup errors.
      }
      scannerRef.current = null;
    }
    setCameraActive(false);
  }

  async function startCamera() {
    if (scannerRef.current) {
      return;
    }

    setCameraActive(true);

    try {
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras.length) {
        toast.error("No camera was found on this device.");
        await stopCamera();
        return;
      }

      const preferredCamera = cameras.find((camera) => /back|rear|environment/i.test(camera.label)) ?? cameras[0];
      const html5QrCode = new Html5Qrcode("reader");

      await html5QrCode.start(
        preferredCamera.id,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        async (decodedText) => {
          setQr(decodedText);
          await lookupResident(decodedText);
          await stopCamera();
        },
        () => {
          // Ignore transient recognition errors while scanning.
        },
      );

      scannerRef.current = html5QrCode;
      toast.success("Camera ready. Point it at the QR code.");
    } catch {
      await stopCamera();
      toast.error("Unable to start the camera scanner. Please try again or upload an image instead.");
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    await stopCamera();

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    const html5QrCode = new Html5Qrcode("reader");
    try {
      const decodedText = await html5QrCode.scanFile(file, true);
      setQr(decodedText);
      await lookupResident(decodedText);
    } catch {
      toast.error("We could not read a QR code from that image. Please try another file.");
    } finally {
      try {
        await html5QrCode.clear();
      } catch {
        // Ignore cleanup errors.
      }
      event.target.value = "";
    }
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScanLine className="h-7 w-7 text-primary" />
          Scan QR Code
        </h1>
        <p className="text-muted-foreground">Verify a resident by scanning with the camera or uploading a QR image</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scan or enter QR code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void startCamera()} disabled={loading || cameraActive} className="gap-2">
              <Camera className="h-4 w-4" />
              {cameraActive ? "Camera active" : "Open camera"}
            </Button>
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" />
              Upload image
            </Button>
            {cameraActive && (
              <Button type="button" variant="outline" onClick={() => void stopCamera()} className="gap-2">
                Stop camera
              </Button>
            )}
          </div>

          <div className={cameraActive ? "rounded-lg border bg-muted/40 p-2" : "hidden"}>
            <div id="reader" className="min-h-[280px] w-full rounded-md bg-black/90" />
          </div>

          {previewUrl && (
            <div className="relative aspect-video rounded-lg border bg-muted/40 p-2">
              <Image src={previewUrl} alt="Uploaded QR code preview" fill className="rounded-md object-contain" sizes="(max-width: 768px) 100vw, 768px" />
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleFileUpload(event)} />

          <form onSubmit={(event) => void lookup(event)} className="space-y-4">
            <div>
              <Label htmlFor="qr">Resident QR code</Label>
              <Input
                id="qr"
                value={qr}
                onChange={(e) => setQr(e.target.value)}
                placeholder="Scan or paste QR code value"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Verifying..." : "Verify resident"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {resident && (
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarImage src={resident.image ?? undefined} />
                <AvatarFallback>{getInitials(resident.name)}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="flex items-center gap-2">
                  {resident.name}
                  <UserCheck className="h-5 w-5 text-primary" />
                </CardTitle>
                <p className="text-sm text-muted-foreground">{resident.email}</p>
                {resident.barangay && (
                  <Badge variant="secondary" className="mt-1">{resident.barangay}</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-muted-foreground">Balance</p>
                <p className="font-bold text-lg">{formatPoints(resident.balance)} pts</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-muted-foreground">Env. score</p>
                <p className="font-bold text-lg">{resident.environmentalScore}</p>
              </div>
            </div>
            <Link href={`/staff/record?residentId=${resident.id}`}>
              <Button className="w-full">Record recycling for this resident</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
