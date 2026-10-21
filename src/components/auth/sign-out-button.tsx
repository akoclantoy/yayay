"use client";

import { useFormStatus } from "react-dom";
import { LogOut } from "lucide-react";
import { signOutToHome } from "@/app/actions/auth";
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
  return (
    <form action={signOutToHome}>
      <SignOutSubmitButton collapsed={collapsed} compact={compact} className={className} />
    </form>
  );
}

function SignOutSubmitButton({
  collapsed,
  compact,
  className,
}: {
  collapsed: boolean;
  compact: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const label = pending ? "Signing out" : "Sign out";

  return (
    <Button
      type="submit"
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
    >
      <LogOut className="h-4 w-4" />
      {!collapsed && !compact && (pending ? "Signing out..." : "Sign out")}
    </Button>
  );
}
