import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PickupMessenger } from "@/components/messaging/pickup-messenger";

export default async function StaffMessagesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "COLLECTION_STAFF" && session.user.role !== "BARANGAY_STAFF" && session.user.role !== "ADMIN") {
    redirect("/resident");
  }

  return <PickupMessenger userId={session.user.id} />;
}
