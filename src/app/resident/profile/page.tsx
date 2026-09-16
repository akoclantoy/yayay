import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ProfileForm } from "@/components/resident/profile-form";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, profile, barangays] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, phone: true, image: true },
    }),
    db.residentProfile.findUnique({
      where: { userId: session.user.id },
      include: { barangay: true },
    }),
    db.barangay.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!user) redirect("/login");

  return (
    <ProfileForm
      user={user}
      profile={{
        address: profile?.address ?? "",
        houseNumber: profile?.houseNumber ?? "",
        barangayId: profile?.barangayId ?? "",
      }}
      barangays={barangays}
    />
  );
}
