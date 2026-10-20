import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { CentersDirectory } from "@/components/centers/centers-directory";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ResidentCentersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RESIDENT") {
    redirect(session.user.role === "ADMIN" ? "/admin" : "/staff");
  }

  const centers = await db.collectionCenter.findMany({
    where: { deletedAt: null },
    include: { barangay: { select: { name: true } }, _count: { select: { recyclingRecords: true } } },
    orderBy: { name: "asc" },
  });

  return <CentersDirectory centers={centers} audience="resident" />;
}
