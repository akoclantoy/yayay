import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "COLLECTION_STAFF" && role !== "ADMIN") redirect("/resident");

  return (
    <DashboardShell role={role}>
      {children}
    </DashboardShell>
  );
}
