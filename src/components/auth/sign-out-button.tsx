"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut({ redirect: false, redirectTo: "/" });
      router.replace("/");
    } catch (error) {
      console.error("[auth] Could not sign out:", error);
      toast.error("Sign out failed. Please try again.");
      setSigningOut(false);
    }
  }

  const label = signingOut ? "Signing out" : "Sign out";

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
      onClick={() => void handleSignOut()}
      disabled={signingOut}
      aria-label={label}
      title={label}
    >
      <LogOut className="h-4 w-4" />
      {!collapsed && !compact && (signingOut ? "Signing out..." : "Sign out")}
    </Button>
  );
}
