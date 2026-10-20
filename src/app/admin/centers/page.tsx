import { db } from "@/lib/db";
import { CentersDirectory } from "@/components/centers/centers-directory";

export default async function AdminCentersPage() {
  const centers = await db.collectionCenter.findMany({
    where: { deletedAt: null },
    include: { barangay: true, _count: { select: { recyclingRecords: true } } },
    orderBy: { name: "asc" },
  });

  return <CentersDirectory centers={centers} audience="admin" />;
}
