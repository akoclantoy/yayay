import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ResidentMessagingHub } from "@/components/messaging/resident-messenger";

export default async function ResidentMessagesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RESIDENT") {
    redirect(session.user.role === "ADMIN" ? "/admin" : "/staff");
  }

  return (
    <ResidentMessagingHub
      residentName={session.user.name ?? "Resident"}
      residentId={session.user.id}
    />
  );
}
