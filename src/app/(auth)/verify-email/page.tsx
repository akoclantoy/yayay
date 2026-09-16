"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error"
  );

  useEffect(() => {
    if (!token) return;

    fetch(`/api/auth/verify-email?token=${token}`)
      .then((res) => {
        setStatus(res.ok ? "success" : "error");
      })
      .catch(() => setStatus("error"));
  }, [token]);

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Verifying your email...</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <CheckCircle2 className="h-14 w-14 text-primary" />
        <h2 className="text-xl font-semibold">Email verified!</h2>
        <p className="text-muted-foreground">
          Your account is ready. Sign in to start recycling and earning rewards.
        </p>
        <Link href="/login">
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <XCircle className="h-14 w-14 text-danger" />
      <h2 className="text-xl font-semibold">Verification failed</h2>
      <p className="text-muted-foreground">
        This link may be invalid or expired. Try registering again or contact
        support.
      </p>
      <Link href="/register">
        <Button variant="outline">Back to register</Button>
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthLayout title="Email verification">
      <Suspense fallback={<Loader2 className="animate-spin mx-auto" />}>
        <VerifyEmailContent />
      </Suspense>
    </AuthLayout>
  );
}
