import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEFAULT_WASTE_CATEGORIES } from "@/lib/constants";

export async function GET() {
  const existingCategories = await db.wasteCategory.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, pointsPerKg: true, type: true },
  });
  const categoryMap = new Map(existingCategories.map((category) => [category.type, category]));

  for (const category of DEFAULT_WASTE_CATEGORIES) {
    if (categoryMap.has(category.type)) continue;
    const created = await db.wasteCategory.create({
      data: {
        type: category.type,
        name: category.name,
        pointsPerKg: category.pointsPerKg,
        carbonFactorKg: category.carbonFactorKg,
      },
      select: { id: true, name: true, pointsPerKg: true, type: true },
    });
    categoryMap.set(created.type, created);
  }

  return NextResponse.json([...categoryMap.values()]);
}
