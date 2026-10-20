import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ResidentMessenger } from "@/components/messaging/resident-messenger";

export default async function ResidentMessagesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RESIDENT") {
    redirect(session.user.role === "ADMIN" ? "/admin" : "/staff");
  }

  return (
    <ResidentMessenger
      residentName={session.user.name ?? "Resident"}
      residentImage={session.user.image ?? null}
    />
  );
}
