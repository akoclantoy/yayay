"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CompletePhoneForm({ destination }: { destination: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/auth/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to save your phone number.");
      toast.success("Phone number saved.");
      router.replace(destination);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save your phone number.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Add your phone number"
      subtitle="A registered phone number is required for signing in and SMS account recovery."
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="required-phone">Phone number</Label>
          <Input
            id="required-phone"
            type="tel"
            autoComplete="tel"
            placeholder="+63 912 345 6789"
            minLength={8}
            maxLength={24}
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Use a number you control and can receive SMS on.
          </p>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <><Loader2 className="animate-spin" />Saving...</> : "Save phone number"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => void signOut({ callbackUrl: "/login" })}
        >
          Sign out
        </Button>
      </form>
    </AuthLayout>
  );
}
