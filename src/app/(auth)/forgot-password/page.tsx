"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RecoveryStep = "identify" | "verify" | "reset" | "done";

async function postRecovery<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Unable to process your request.");
  return result;
}

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<RecoveryStep>("identify");
  const [identifier, setIdentifier] = useState("");
  const [phone, setPhone] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const resendSeconds = Math.max(0, Math.ceil((resendAvailableAt - currentTime) / 1000));

  useEffect(() => {
    if (!resendAvailableAt) return;
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [resendAvailableAt]);

  function startResendCooldown() {
    const now = Date.now();
    setCurrentTime(now);
    setResendAvailableAt(now + 60_000);
  }

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    try {
      const result = await postRecovery<{ challengeId: string; message: string }>(
        "/api/auth/forgot-password",
        { identifier, phone },
      );
      setChallengeId(result.challengeId);
      setStep("verify");
      startResendCooldown();
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to request a verification code.");
    } finally {
      setWorking(false);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    try {
      const result = await postRecovery<{ resetToken: string }>(
        "/api/auth/verify-recovery-otp",
        { challengeId, code },
      );
      setResetToken(result.resetToken);
      setStep("reset");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The code could not be verified.");
    } finally {
      setWorking(false);
    }
  }

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      toast.error("Your password must be at least 8 characters.");
      return;
    }

    setWorking(true);
    try {
      await postRecovery("/api/auth/reset-password", {
        challengeId,
        resetToken,
        password,
        confirmPassword,
      });
      setStep("done");
      toast.success("Password reset successfully. Sign in with your new password.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reset your password.");
    } finally {
      setWorking(false);
    }
  }

  async function resendCode() {
    setWorking(true);
    try {
      const result = await postRecovery<{ challengeId: string; message: string }>(
        "/api/auth/forgot-password",
        { identifier, phone },
      );
      setChallengeId(result.challengeId);
      setCode("");
      startResendCooldown();
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send another code.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <AuthLayout
      title={step === "done" ? "Password updated" : "Recover your account"}
      subtitle={
        step === "identify"
          ? "Verify your registered mobile number to reset your password"
          : step === "verify"
            ? "Enter the 6-digit code sent to your registered mobile number"
            : step === "reset"
              ? "Choose a new password for your account"
              : "Your account is ready to use again"
      }
    >
      {step === "identify" && (
        <form onSubmit={(event) => void requestCode(event)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recovery-phone">Registered phone number</Label>
            <Input
              id="recovery-phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+63 912 345 6789"
              minLength={8}
              maxLength={24}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-identifier">Email or username/account name</Label>
            <Input
              id="account-identifier"
              autoComplete="username"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="Email or registered username"
              minLength={3}
              maxLength={254}
              required
            />
            <p className="text-xs leading-5 text-muted-foreground">
              For your protection, we only send codes to a mobile number already saved on the account.
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={working || identifier.trim().length < 3}>
            {working ? <><Loader2 className="animate-spin" />Checking account...</> : "Send verification code"}
          </Button>
          <Link href="/login" className="block text-center text-sm text-primary hover:underline">
            Back to sign in
          </Link>
        </form>
      )}

      {step === "verify" && (
        <form onSubmit={(event) => void verifyCode(event)} className="space-y-4">
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">
            If an account matches those details and has a registered mobile number, a code has been sent. It expires in 5 minutes. Codes can be resent once per minute.
          </div>
          <div className="space-y-2">
            <Label htmlFor="recovery-code">Verification code</Label>
            <Input
              id="recovery-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              required
              className="text-center text-xl tracking-[0.4em]"
            />
          </div>
          <Button type="submit" className="w-full" disabled={working || code.length !== 6}>
            {working ? <><Loader2 className="animate-spin" />Verifying...</> : "Verify code"}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={() => { setStep("identify"); setCode(""); }} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />Change account
            </button>
            <button type="button" onClick={() => void resendCode()} disabled={working || resendSeconds > 0} className="font-medium text-primary hover:underline disabled:opacity-50">
              {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}
            </button>
          </div>
        </form>
      )}

      {step === "reset" && (
        <form onSubmit={(event) => void resetPassword(event)} className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm leading-6 text-muted-foreground">Your mobile number is verified. Choose a password with at least 8 characters.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={working}>
            {working ? <><Loader2 className="animate-spin" />Updating password...</> : "Reset password"}
          </Button>
        </form>
      )}

      {step === "done" && (
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
          <p className="text-sm text-muted-foreground">Your password has been changed. You can now sign in using your new password.</p>
          <Link href="/login">
            <Button className="w-full"><ArrowLeft className="h-4 w-4" />Return to sign in</Button>
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}
