import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEFAULT_WASTE_CATEGORIES } from "@/lib/constants";

export async function GET() {
  const persistedCategories = await Promise.all(
    DEFAULT_WASTE_CATEGORIES.map(async (category) =>
      db.wasteCategory.upsert({
        where: { type: category.type },
        update: {
          name: category.name,
          pointsPerKg: category.pointsPerKg,
          carbonFactorKg: category.carbonFactorKg,
          isActive: true,
        },
        create: {
          type: category.type,
          name: category.name,
          pointsPerKg: category.pointsPerKg,
          carbonFactorKg: category.carbonFactorKg,
        },
        select: { id: true, name: true, pointsPerKg: true, type: true },
      }),
    ),
  );

  const categoryMap = new Map(persistedCategories.map((category) => [category.type, category]));

  const categories = [
    { id: categoryMap.get("ORGANIC")?.id ?? "", name: "Biodegradable Waste (Organic)", pointsPerKg: 5, type: "ORGANIC" },
    { id: categoryMap.get("PLASTIC")?.id ?? "", name: "Recyclable Waste (Plastic)", pointsPerKg: 10, type: "PLASTIC" },
    { id: categoryMap.get("PAPER")?.id ?? "", name: "Recyclable Waste (Paper)", pointsPerKg: 8, type: "PAPER" },
    { id: categoryMap.get("GLASS")?.id ?? "", name: "Recyclable Waste (Glass)", pointsPerKg: 12, type: "GLASS" },
    { id: categoryMap.get("METAL")?.id ?? "", name: "Recyclable Waste (Metal)", pointsPerKg: 15, type: "METAL" },
    { id: categoryMap.get("OTHER")?.id ?? "", name: "Residual Waste (Non-Recyclable)", pointsPerKg: 3, type: "OTHER" },
    { id: categoryMap.get("HAZARDOUS")?.id ?? "", name: "Hazardous Waste", pointsPerKg: 20, type: "HAZARDOUS" },
    { id: categoryMap.get("ELECTRONICS")?.id ?? "", name: "Electronic Waste (E-Waste)", pointsPerKg: 25, type: "ELECTRONICS" },
    { id: categoryMap.get("TEXTILE")?.id ?? "", name: "Medical Waste", pointsPerKg: 7, type: "TEXTILE" },
    { id: categoryMap.get("OTHER")?.id ?? "", name: "Construction Waste", pointsPerKg: 4, type: "OTHER" },
  ].filter((category) => category.id);

  return NextResponse.json(categories);
}
