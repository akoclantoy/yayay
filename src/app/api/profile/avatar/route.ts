import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { uploadImage } from "@/lib/cloudinary";
import { db } from "@/lib/db";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;

  const formData = await request.formData();
  const image = formData.get("image");

  if (!(image instanceof File)) {
    return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
    return NextResponse.json({ error: "Use a JPG, PNG, or WebP image." }, { status: 400 });
  }
  if (image.size > MAX_AVATAR_SIZE) {
    return NextResponse.json({ error: "Choose an image smaller than 5 MB." }, { status: 400 });
  }
  if (image.size === 0) {
    return NextResponse.json({ error: "The selected image is empty." }, { status: 400 });
  }

  try {
    const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");
    const uploadedImage = await uploadImage(
      `data:${image.type};base64,${base64}`,
      "resident-avatars"
    );
    await db.user.update({
      where: { id: authResult.session.user.id },
      data: { image: uploadedImage.url },
    });

    return NextResponse.json({ image: uploadedImage.url });
  } catch {
    return NextResponse.json({ error: "We couldn't save your photo. Please try again." }, { status: 500 });
  }
}

export async function DELETE() {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;

  await db.user.update({
    where: { id: authResult.session.user.id },
    data: { image: null },
  });

  return NextResponse.json({ image: null });
}