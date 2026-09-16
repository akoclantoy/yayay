import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ResidentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <DashboardShell role={session.user.role ?? "RESIDENT"}>
      {children}
    </DashboardShell>
  );
}
