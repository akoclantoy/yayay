import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { normalizePhilippinePhone } from "@/lib/sms-recovery";
import { CompletePhoneForm } from "@/components/auth/complete-phone-form";

export const dynamic = "force-dynamic";

export default async function CompleteProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true, role: true, isActive: true, deletedAt: true },
  });
  if (!user || !user.isActive || user.deletedAt) redirect("/login");
  if (normalizePhilippinePhone(user.phone)) {
    redirect(user.role === "ADMIN" ? "/admin" : user.role === "RESIDENT" ? "/resident" : "/staff");
  }

  const destination = user.role === "ADMIN" ? "/admin" : user.role === "RESIDENT" ? "/resident" : "/staff";
  return <CompletePhoneForm destination={destination} />;
}
