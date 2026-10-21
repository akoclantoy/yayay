"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ChangePasswordResponse = {
  error?: string | Record<string, string[]>;
};

export function PasswordUpdateForm() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json()) as ChangePasswordResponse;

      if (!response.ok) {
        const message =
          typeof result.error === "string"
            ? result.error
            : Object.values(result.error ?? {}).flat()[0] ??
              "Unable to update your password.";
        throw new Error(message);
      }

      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Password updated successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update your password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          Update password
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Enter your current password, then choose and confirm a new password.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              value={form.currentPassword}
              onChange={(event) =>
                setForm({ ...form, currentPassword: event.target.value })
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={form.newPassword}
                onChange={(event) =>
                  setForm({ ...form, newPassword: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm new password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={form.confirmPassword}
                onChange={(event) =>
                  setForm({ ...form, confirmPassword: event.target.value })
                }
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Use at least 8 characters, including an uppercase letter and a number.
          </p>
          <Button type="submit" disabled={loading}>
            {loading ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
            {loading ? "Updating..." : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
