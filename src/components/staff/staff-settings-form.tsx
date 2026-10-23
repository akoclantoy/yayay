"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Check, LoaderCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STAFF_PROFILE_IMAGE } from "@/lib/constants";
import { getInitials } from "@/lib/utils";

type StaffSettingsData = {
  name: string;
  email: string;
  phone: string;
  role: string;
  image: string | null;
  employeeId: string | null;
  assignedCenter: string | null;
  createdAt: string;
  emailVerified: boolean;
  isActive: boolean;
  isStaff: boolean;
};

type UpdateResponse = {
  error?: string | Record<string, string[]>;
};

export function StaffSettingsForm({ staff }: { staff: StaffSettingsData }) {
  const router = useRouter();
  const { update } = useSession();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: staff.name, phone: staff.phone });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/staff/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json()) as UpdateResponse;

      if (!response.ok) {
        const message =
          typeof result.error === "string"
            ? result.error
            : Object.values(result.error ?? {}).flat()[0] ??
              "Unable to save your staff details.";
        throw new Error(message);
      }

      await update();
      toast.success("Staff details updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save your staff details.");
    } finally {
      setLoading(false);
    }
  }

  const photo = staff.isStaff ? STAFF_PROFILE_IMAGE : staff.image;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="h-20 w-20 border">
            <AvatarImage src={photo ?? undefined} className="object-cover" />
            <AvatarFallback>{getInitials(staff.name)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <CardTitle>{staff.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{staff.email}</p>
            <Badge variant={staff.isActive ? "default" : "secondary"}>
              {staff.isActive ? "Active account" : "Inactive account"}
            </Badge>
            {staff.isStaff && (
              <p className="text-xs text-muted-foreground">
                Staff profile pictures are managed by EcoRewards.
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h2 className="mb-3 text-sm font-semibold">Account information</h2>
          <dl className="grid gap-4 rounded-xl border border-border/70 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Email address</dt>
              <dd className="mt-1 font-medium break-all">{staff.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Staff role</dt>
              <dd className="mt-1 font-medium">{staff.role}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Employee ID</dt>
              <dd className="mt-1 font-medium">{staff.employeeId ?? "Not assigned"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Assigned collection center</dt>
              <dd className="mt-1 font-medium">{staff.assignedCenter ?? "Not assigned"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="mt-1 font-medium">{staff.createdAt}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email verification</dt>
              <dd className="mt-1 font-medium">{staff.emailVerified ? "Verified" : "Not verified"}</dd>
            </div>
          </dl>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 border-t border-border/70 pt-5">
          <h2 className="text-sm font-semibold">Contact details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="staff-name">Full name</Label>
              <Input
                id="staff-name"
                autoComplete="name"
                minLength={2}
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-phone">Phone number</Label>
              <Input
                id="staff-phone"
                type="tel"
                autoComplete="tel"
                required
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Your email address and staff assignment are managed by an administrator.
          </p>
          <Button type="submit" disabled={loading}>
            {loading ? <LoaderCircle className="animate-spin" /> : <Check />}
            {loading ? "Saving..." : "Save staff details"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
