"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Check, ImagePlus, Leaf, LoaderCircle, Mail, MapPin, Trash2 } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { PasswordUpdateForm } from "@/components/account/password-update-form";

type Barangay = { id: string; name: string };

export function ProfileForm({
  user,
  profile,
  barangays,
}: {
  user: { name: string | null; email: string; phone: string | null; image: string | null };
  profile: { address: string; houseNumber: string; barangayId: string };
  barangays: Barangay[];
}) {
  const router = useRouter();
  const { update } = useSession();
  const avatarInput = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatar, setAvatar] = useState(user.image);
  const [form, setForm] = useState({
    name: user.name ?? "",
    phone: user.phone ?? "",
    address: profile.address,
    houseNumber: profile.houseNumber,
    barangayId: profile.barangayId,
  });

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file to continue.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Choose an image smaller than 5 MB.");
      return;
    }

    setAvatarLoading(true);
    try {
      const body = new FormData();
      body.set("image", file);
      const response = await fetch("/api/profile/avatar", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to update your photo.");
      setAvatar(data.image);
      await update();
      router.refresh();
      toast.success("Profile photo updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update your photo.");
    } finally {
      setAvatarLoading(false);
    }
  }

  async function handleAvatarRemove() {
    setAvatarLoading(true);
    try {
      const response = await fetch("/api/profile/avatar", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to remove your photo.");
      setAvatar(data.image);
      await update();
      router.refresh();
      toast.success("Profile photo removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove your photo.");
    } finally {
      setAvatarLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json() as {
        error?: string | { fieldErrors?: Record<string, string[]> };
      };
      if (!res.ok) {
        const message =
          typeof data.error === "string"
            ? data.error
            : Object.values(data.error?.fieldErrors ?? {}).flat()[0] ?? "Update failed";
        throw new Error(message);
      }
      await update();
      router.refresh();
      toast.success("Profile updated", { description: "Your barangay and resident details are saved." });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 pb-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Account / Resident</p>
        <h1 className="text-3xl font-semibold tracking-tight">Your profile</h1>
        <p className="max-w-xl text-sm text-muted-foreground">A clear picture and up-to-date details help your community recognize you.</p>
      </header>

      <section className="relative isolate overflow-hidden rounded-[8px] border border-[#2d6650] bg-[#174b37] text-white shadow-[0_18px_50px_-32px_rgba(18,61,43,0.8)]">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(115deg,transparent_0%,rgba(189,221,130,0.12)_46%,transparent_46.2%,transparent_53%,rgba(189,221,130,0.08)_53.2%,transparent_85%),radial-gradient(ellipse_at_90%_10%,rgba(191,222,126,0.18),transparent_34%)]" />
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:gap-8 sm:p-8">
          <div className="relative w-fit shrink-0">
            <Avatar className="h-24 w-24 border-[3px] border-white/80 bg-[#d8e7c7] shadow-xl shadow-black/20 sm:h-28 sm:w-28">
              <AvatarImage src={avatar ?? undefined} className="object-cover" />
              <AvatarFallback className="bg-[#d8e7c7] text-2xl font-semibold text-[#174b37]">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => avatarInput.current?.click()}
              disabled={avatarLoading}
              aria-label="Change profile picture"
              title="Change profile picture"
              className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-[#174b37] bg-[#d6ec91] text-[#174b37] shadow-md transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60"
            >
              {avatarLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input
              ref={avatarInput}
              id="avatar-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              className="sr-only"
              aria-label="Choose a profile picture"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2 text-[#d6ec91]">
              <Leaf className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.14em]">EcoRewards resident</span>
            </div>
            <h2 className="truncate text-2xl font-semibold tracking-tight sm:text-[28px]">{user.name || "Your name"}</h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-white/75">
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">{user.email}</span>
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                type="button"
                onClick={() => avatarInput.current?.click()}
                disabled={avatarLoading}
                className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-white px-3.5 text-sm font-semibold text-[#174b37] transition hover:bg-[#eaf3dc] disabled:opacity-60"
              >
                <ImagePlus className="h-4 w-4" />
                {avatarLoading ? "Uploading photo..." : avatar ? "Change photo" : "Add a photo"}
              </button>
              {avatar && (
                <button
                  type="button"
                  onClick={handleAvatarRemove}
                  disabled={avatarLoading}
                  className="inline-flex h-9 items-center gap-2 rounded-[6px] px-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              )}
              <span className="text-xs text-white/60">JPG, PNG or WebP · up to 5 MB</span>
            </div>
          </div>
          <div className="hidden shrink-0 items-center gap-2 self-end text-sm text-white/70 sm:flex sm:self-center">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[#d6ec91]"><Check className="h-4 w-4" /></span>
            Resident account
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[8px] border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-5 sm:px-7">
          <h2 className="text-lg font-semibold">Personal details</h2>
          <p className="mt-1 text-sm text-muted-foreground">Your contact and collection address information.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6 px-5 py-6 sm:px-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input id="phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barangay">Barangay</Label>
              <select
                id="barangay"
                value={form.barangayId}
                onChange={(e) => setForm({ ...form, barangayId: e.target.value })}
                className="flex h-11 w-full rounded-xl border border-border/80 bg-white/80 px-4 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-white/5"
              >
                <option value="">Select barangay</option>
                {barangays.map((barangay) => <option key={barangay.id} value={barangay.id}>{barangay.name}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">Used to show local collection information.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="house">House number</Label>
              <Input id="house" value={form.houseNumber} onChange={(e) => setForm({ ...form, houseNumber: e.target.value })} autoComplete="address-line2" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Street address</Label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} autoComplete="street-address" className="pl-10" />
              </div>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Your email address is managed through your sign-in account.</p>
            <Button type="submit" disabled={loading} className="sm:min-w-36">
              {loading ? <LoaderCircle className="animate-spin" /> : <Check />}
              {loading ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </section>
      <PasswordUpdateForm />
    </div>
  );
}
