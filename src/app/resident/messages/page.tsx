import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PickupMessenger } from "@/components/messaging/pickup-messenger";

export default async function ResidentMessagesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RESIDENT") {
    redirect(session.user.role === "ADMIN" ? "/admin" : "/staff");
  }

  return <PickupMessenger userId={session.user.id} />;
}
