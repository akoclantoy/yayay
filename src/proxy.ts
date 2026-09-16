import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";
import type { UserRole } from "@/generated/prisma/enums";
import { ROLE_DASHBOARD } from "@/lib/constants";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

const AUTH_PATHS = ["/login", "/register", "/forgot-password"];

const ROLE_PREFIX: Record<UserRole, string> = {
  ADMIN: "/admin",
  COLLECTION_STAFF: "/staff",
  BARANGAY_STAFF: "/barangay",
  RESIDENT: "/resident",
  GUEST: "/",
};

function isPublic(path: string) {
  if (PUBLIC_PATHS.includes(path)) return true;
  if (path.startsWith("/api/auth")) return true;
  if (path === "/api/health") return true;
  if (path === "/api/stats/public") return true;
  return false;
}

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const session = req.auth;
  const isLoggedIn = !!session?.user;

  if (
    path.startsWith("/_next") ||
    path.startsWith("/favicon") ||
    path.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/)
  ) {
    return NextResponse.next();
  }

  if (isPublic(path)) {
    if (isLoggedIn && AUTH_PATHS.includes(path)) {
      const role = session.user.role ?? "RESIDENT";
      return NextResponse.redirect(new URL(ROLE_DASHBOARD[role], req.url));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(login);
  }

  const role = session.user.role ?? "RESIDENT";

  if (path.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL(ROLE_PREFIX[role], req.url));
  }

  if (
    path.startsWith("/staff") &&
    role !== "COLLECTION_STAFF" &&
    role !== "ADMIN"
  ) {
    return NextResponse.redirect(new URL(ROLE_PREFIX[role], req.url));
  }

  if (
    path.startsWith("/barangay") &&
    role !== "BARANGAY_STAFF" &&
    role !== "ADMIN"
  ) {
    return NextResponse.redirect(new URL(ROLE_PREFIX[role], req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};