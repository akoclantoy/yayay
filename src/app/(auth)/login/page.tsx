"use client";

import { Suspense } from "react";
import LoginPage from "./login-content";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginPage />
    </Suspense>
  );
}
