"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthLayout, AuthDivider, GoogleButton } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerSchema, type RegisterInput } from "@/lib/validators/auth";
import { showAuthErrorToast } from "@/lib/auth-error-handler";

export default function RegisterPage() {
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterInput) {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      let json: { error?: unknown; autoVerified?: boolean } = {};
      try {
        json = await res.json();
      } catch (fetchError) {
        const errorToast = showAuthErrorToast(fetchError);
        toast.error(errorToast.title, {
          description: errorToast.message,
        });
        return;
      }

      if (!res.ok) {
        let toastMessage = "Registration failed. Please check your details.";

        if (json?.error && typeof json.error === "object") {
          for (const [field, messages] of Object.entries(json.error)) {
            if (Array.isArray(messages) && messages.length > 0) {
              setError(field as keyof RegisterInput, {
                type: "server",
                message: String(messages[0]),
              });
              toastMessage = String(messages[0]);
              break;
            }
          }
        }

        if (typeof json.error === "string") {
          toastMessage = json.error;
        } else if (Array.isArray(json?.error)) {
          toastMessage = json.error.join(" ");
        }

        toast.error(toastMessage);
        return;
      }

      toast.success(
        json.autoVerified
          ? "Account created! Signing you in..."
          : "Account created! Check your email to verify."
      );

      if (json.autoVerified) {
        const signInResult = await signIn("credentials", {
          email: data.email.trim().toLowerCase(),
          password: data.password,
          redirect: false,
        });

        if (signInResult?.error) {
          const errorToast = showAuthErrorToast(signInResult);
          toast.error(errorToast.title, {
            description: errorToast.message,
          });
          router.push("/login");
          return;
        }

        router.push("/resident");
        router.refresh();
        return;
      }

      router.push("/login");
    } catch (error) {
      const errorToast = showAuthErrorToast(error);
      toast.error(errorToast.title, {
        description: errorToast.message,
      });
    }
  }

  async function handleGoogle() {
    try {
      setGoogleLoading(true);
      await signIn("google", { callbackUrl: "/resident" });
    } catch (error) {
      const errorToast = showAuthErrorToast(error);
      toast.error(errorToast.title, {
        description: errorToast.message,
      });
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start earning rewards for recycling today"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" placeholder="Juan Dela Cruz" {...register("name")} />
          {errors.name && (
            <p className="text-sm text-danger">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-danger">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input id="phone" placeholder="+63 912 345 6789" {...register("phone")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            {...register("password")}
          />
          <p className="text-sm text-muted-foreground">
            Use at least 8 characters and include one uppercase letter and one
            number.
          </p>
          {errors.password && (
            <p className="text-sm text-danger">{errors.password.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="text-sm text-danger">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      <AuthDivider />
      <GoogleButton onClick={handleGoogle} loading={googleLoading} />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
