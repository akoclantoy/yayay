"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { AuthLayout, AuthDivider, GoogleButton } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";
import { showAuthErrorToast } from "@/lib/auth-error-handler";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/resident";
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    try {
      const result = await signIn("credentials", {
        email: data.email.trim().toLowerCase(),
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        const errorToast = showAuthErrorToast(result);

        // Add specific guidance for database errors
        if (errorToast.title === "Database Connection Error") {
          toast.error(errorToast.title, {
            description: `${errorToast.message} For demo purposes, you can use: admin@example.com / Admin123!`,
          });
        } else {
          toast.error(errorToast.title, {
            description: errorToast.message,
          });
        }
        return;
      }

      toast.success("Welcome back!");
      router.push(callbackUrl);
      router.refresh();
    } catch (error) {
      const errorToast = showAuthErrorToast(error);

      // Add specific guidance for database errors
      if (errorToast.title === "Database Connection Error") {
        toast.error(errorToast.title, {
          description: `${errorToast.message} For demo purposes, you can use: admin@example.com / Admin123!`,
        });
      } else {
        toast.error(errorToast.title, {
          description: errorToast.message,
        });
      }
    }
  }

  async function handleGoogle() {
    try {
      setGoogleLoading(true);
      await signIn("google", { callbackUrl });
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
      title="Welcome back"
      subtitle="Sign in to your EcoRewards account"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-danger">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-sm text-danger">{errors.password.message}</p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      <AuthDivider />
      <GoogleButton onClick={handleGoogle} loading={googleLoading} />

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-primary font-medium hover:underline">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}
