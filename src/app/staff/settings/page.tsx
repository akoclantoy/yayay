import { auth } from "@/auth";
import { PasswordUpdateForm } from "@/components/account/password-update-form";
import { StaffSettingsForm } from "@/components/staff/staff-settings-form";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export default async function StaffSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      staffProfile: {
        include: { assignedCenter: { select: { name: true } } },
      },
    },
  });
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Account / Staff
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Staff settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review your account information and keep your contact details up to date.
        </p>
      </header>

      <StaffSettingsForm
        staff={{
          name: user.name ?? "",
          email: user.email,
          phone: user.phone ?? "",
          role: user.role,
          image: user.image,
          employeeId: user.staffProfile?.employeeId ?? null,
          assignedCenter: user.staffProfile?.assignedCenter?.name ?? null,
          createdAt: user.createdAt.toLocaleDateString("en-PH", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          emailVerified: Boolean(user.emailVerified),
          isActive: user.isActive && !user.deletedAt,
          isStaff: user.role === "COLLECTION_STAFF" || user.role === "BARANGAY_STAFF",
        }}
      />
      <PasswordUpdateForm />
    </div>
  );
}
