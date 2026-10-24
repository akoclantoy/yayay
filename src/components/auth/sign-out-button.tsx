"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SignOutButton({
  collapsed = false,
  compact = false,
  className,
}: {
  collapsed?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const label = pending ? "Signing out" : "Sign out";

  async function handleSignOut() {
    setPending(true);
    try {
      await signOut({ redirect: false, redirectTo: "/" });
      window.location.replace("/");
    } catch (error) {
      console.error("[auth:sign-out]", error);
      toast.error("Unable to sign out. Please try again.");
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "text-muted-foreground",
        compact
          ? "h-10 w-10 rounded-full p-0"
          : collapsed
            ? "mt-2 w-full justify-center px-0"
            : "mt-2 w-full justify-start",
        className,
      )}
      disabled={pending}
      aria-label={label}
      title={label}
      onClick={handleSignOut}
    >
      <LogOut className="h-4 w-4" />
      {!collapsed && !compact && (pending ? "Signing out..." : "Sign out")}
    </Button>
  );
}
