import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { db } from "@/lib/db";
import { normalizePhilippinePhone } from "@/lib/sms-recovery";

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
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true, isActive: true, deletedAt: true },
  });
  if (!user || !user.isActive || user.deletedAt) redirect("/login");
  if (!normalizePhilippinePhone(user.phone)) redirect("/complete-profile");

  return (
    <DashboardShell role={role}>
      {children}
    </DashboardShell>
  );
}
