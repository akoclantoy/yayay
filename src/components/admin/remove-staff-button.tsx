"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RemoveStaffButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRemove() {
    if (!window.confirm(`Remove staff account for ${name}? They will no longer be able to sign in.`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/staff/${userId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to remove account");

      toast.success("Staff account removed.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      onClick={handleRemove}
      disabled={loading}
      aria-label={`Remove ${name}`}
    >
      <Trash2 />
      {loading ? "Removing..." : "Remove"}
    </Button>
  );
}