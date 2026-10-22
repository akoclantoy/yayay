import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";

export default function ResetPasswordPage() {
  return (
    <AuthLayout
      title="Verify your account first"
      subtitle="Password recovery now uses a code sent to your registered mobile number"
    >
      <div className="space-y-5 text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-primary" />
        <p className="text-sm leading-6 text-muted-foreground">
          Email reset links are no longer accepted. Start account recovery and verify your registered phone number to choose a new password.
        </p>
        <Link href="/forgot-password" className="block">
          <Button className="w-full">Recover account</Button>
        </Link>
        <Link href="/login" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" />Back to sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
