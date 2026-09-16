import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { recordRecycling } from "@/lib/services/recycling";
import { z } from "zod";

const schema = z.object({
  residentId: z.string().min(1),
  wasteCategoryId: z.string().min(1),
  weightKg: z.number().positive(),
  quantity: z.number().int().positive().optional(),
  centerId: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  const authResult = await requireRole(["COLLECTION_STAFF", "ADMIN"]);
  if ("error" in authResult) return authResult.error;

  try {
    const body = await request.json();
    const data = schema.parse(body);

    const record = await recordRecycling({
      ...data,
      recordedById: authResult.session.user.id,
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("[recycling POST]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to record recycling" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const authResult = await requireRole(["COLLECTION_STAFF", "ADMIN", "RESIDENT"]);
  if ("error" in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const residentId = searchParams.get("residentId");
  const role = authResult.session.user.role;

  const where =
    role === "RESIDENT"
      ? { residentId: authResult.session.user.id, deletedAt: null }
      : residentId
        ? { residentId, deletedAt: null }
        : { deletedAt: null };

  const records = await db.recyclingRecord.findMany({
    where,
    orderBy: { collectionDate: "desc" },
    take: 50,
    include: {
      wasteCategory: true,
      center: true,
      recordedBy: { select: { name: true } },
    },
  });

  return NextResponse.json(records);
}
