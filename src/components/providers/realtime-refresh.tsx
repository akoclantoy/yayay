"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export function RealtimeRefresh() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;

    const events = new EventSource("/api/realtime");
    const refresh = () => router.refresh();
    events.addEventListener("invalidate", refresh);

    return () => {
      events.removeEventListener("invalidate", refresh);
      events.close();
    };
  }, [router, status]);

  return null;
}
