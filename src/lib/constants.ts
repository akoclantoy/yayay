import type { UserRole, WasteType } from "@/generated/prisma/enums";

export const APP_NAME = "EcoRewards";
export const APP_TAGLINE =
  "Transforming Waste into Rewards through Smart Recycling.";

export const COLORS = {
  primary: "#16A34A",
  secondary: "#10B981",
  accent: "#84CC16",
  warning: "#F59E0B",
  danger: "#EF4444",
  background: "#F8FAFC",
} as const;

export const ROLE_DASHBOARD: Record<UserRole, string> = {
  ADMIN: "/admin",
  COLLECTION_STAFF: "/staff",
  BARANGAY_STAFF: "/barangay",
  RESIDENT: "/resident",
  GUEST: "/",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrator",
  COLLECTION_STAFF: "Collection Staff",
  BARANGAY_STAFF: "Barangay Staff",
  RESIDENT: "Resident",
  GUEST: "Guest",
};

export const WASTE_TYPE_LABELS: Record<WasteType, string> = {
  PLASTIC: "Plastic",
  PAPER: "Paper",
  GLASS: "Glass",
  METAL: "Metal",
  ELECTRONICS: "Electronics",
  ORGANIC: "Organic",
  TEXTILE: "Textile",
  HAZARDOUS: "Hazardous",
  OTHER: "Other",
};

const CUSTOM_WASTE_CATEGORIES = [
  { type: "ORGANIC" as const, name: "Biodegradable Waste (Organic)", pointsPerKg: 5, carbonFactorKg: 0.5 },
  { type: "PLASTIC" as const, name: "Recyclable Waste (Plastic)", pointsPerKg: 10, carbonFactorKg: 2.5 },
  { type: "PAPER" as const, name: "Recyclable Waste (Paper)", pointsPerKg: 8, carbonFactorKg: 1.8 },
  { type: "GLASS" as const, name: "Recyclable Waste (Glass)", pointsPerKg: 12, carbonFactorKg: 0.8 },
  { type: "METAL" as const, name: "Recyclable Waste (Metal)", pointsPerKg: 15, carbonFactorKg: 4.0 },
  { type: "OTHER" as const, name: "Residual Waste (Non-Recyclable)", pointsPerKg: 3, carbonFactorKg: 0.3 },
  { type: "HAZARDOUS" as const, name: "Hazardous Waste", pointsPerKg: 20, carbonFactorKg: 3.0 },
  { type: "ELECTRONICS" as const, name: "Electronic Waste (E-Waste)", pointsPerKg: 25, carbonFactorKg: 6.0 },
  { type: "TEXTILE" as const, name: "Medical Waste", pointsPerKg: 7, carbonFactorKg: 1.2 },
  { type: "OTHER" as const, name: "Construction Waste", pointsPerKg: 4, carbonFactorKg: 1.0 },
];

export const DEFAULT_WASTE_CATEGORIES: {
  type: WasteType;
  name: string;
  pointsPerKg: number;
  carbonFactorKg: number;
}[] = [
  { type: "PLASTIC", name: "Plastic", pointsPerKg: 10, carbonFactorKg: 2.5 },
  { type: "PAPER", name: "Paper", pointsPerKg: 8, carbonFactorKg: 1.8 },
  { type: "GLASS", name: "Glass", pointsPerKg: 12, carbonFactorKg: 0.8 },
  { type: "METAL", name: "Metal", pointsPerKg: 15, carbonFactorKg: 4.0 },
  {
    type: "ELECTRONICS",
    name: "Electronics",
    pointsPerKg: 25,
    carbonFactorKg: 6.0,
  },
  { type: "ORGANIC", name: "Organic", pointsPerKg: 5, carbonFactorKg: 0.5 },
  { type: "TEXTILE", name: "Textile", pointsPerKg: 7, carbonFactorKg: 1.2 },
  {
    type: "HAZARDOUS",
    name: "Hazardous",
    pointsPerKg: 20,
    carbonFactorKg: 3.0,
  },
  { type: "OTHER", name: "Other", pointsPerKg: 3, carbonFactorKg: 0.3 },
  ...CUSTOM_WASTE_CATEGORIES,
];
