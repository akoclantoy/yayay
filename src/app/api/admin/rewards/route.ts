import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { uploadImage } from "@/lib/cloudinary";
import { db } from "@/lib/db";
import { pointsToCurrency } from "@/lib/utils";

const rewardSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  type: z.enum(["VOUCHER", "CASH", "GIFT", "DISCOUNT", "BARANGAY_INCENTIVE"]),
  pointsCost: z.number().int().positive(),
  stock: z.number().int().nonnegative(),
  imageData: z.string().startsWith("data:image/").optional().nullable(),
});

const updateSchema = rewardSchema.extend({ id: z.string().min(1) });

async function imageUrlFromPayload(imageData: string | null | undefined) {
  if (!imageData) return undefined;
  try {
    const uploaded = await uploadImage(imageData, "rewards");
    return uploaded.url;
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  const authResult = await requireRole(["ADMIN"]);
  if ("error" in authResult) return authResult.error;

  try {
    const payload = rewardSchema.parse(await request.json());
    const imageUrl = await imageUrlFromPayload(payload.imageData);
    const reward = await db.reward.create({
      data: {
        name: payload.name,
        description: payload.description || null,
        type: payload.type,
        pointsCost: payload.pointsCost,
        cashValue: pointsToCurrency(payload.pointsCost),
        stock: payload.stock,
        imageUrl: imageUrl ?? null,
      },
    });
    return NextResponse.json({
      ...reward,
      warning: payload.imageData && !imageUrl
        ? "Reward created, but the image could not be uploaded. Configure Cloudinary to store reward images."
        : undefined,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create reward" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authResult = await requireRole(["ADMIN"]);
  if ("error" in authResult) return authResult.error;

  try {
    const payload = updateSchema.parse(await request.json());
    const imageUrl = await imageUrlFromPayload(payload.imageData);
    const reward = await db.reward.update({
      where: { id: payload.id },
      data: {
        name: payload.name,
        description: payload.description || null,
        type: payload.type,
        pointsCost: payload.pointsCost,
        cashValue: pointsToCurrency(payload.pointsCost),
        stock: payload.stock,
        ...(imageUrl ? { imageUrl } : {}),
      },
    });
    return NextResponse.json({
      ...reward,
      warning: payload.imageData && !imageUrl
        ? "Reward updated, but the new image could not be uploaded. Configure Cloudinary to store reward images."
        : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update reward" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authResult = await requireRole(["ADMIN"]);
  if ("error" in authResult) return authResult.error;

  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(await request.json());
    await db.reward.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete reward" }, { status: 500 });
  }
}