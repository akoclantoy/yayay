import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";

const updateSchema = z.object({
  id: z.string().min(1),
  pointsPerKg: z.number().positive().finite(),
});

export async function PATCH(request: Request) {
  const authResult = await requireRole(["ADMIN"]);
  if ("error" in authResult) return authResult.error;

  try {
    const { id, pointsPerKg } = updateSchema.parse(await request.json());
    const category = await db.wasteCategory.update({
      where: { id },
      data: { pointsPerKg },
    });
    return NextResponse.json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update waste points" }, { status: 500 });
  }
}