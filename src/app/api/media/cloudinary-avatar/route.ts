import { NextResponse } from "next/server";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function GET(request: Request) {
  const rawUrl = new URL(request.url).searchParams.get("url");
  if (!rawUrl) {
    return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
  }

  let imageUrl: URL;
  try {
    imageUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const cloudinaryPath = imageUrl.pathname.split("/");
  const isCloudinaryAvatar =
    imageUrl.protocol === "https:" &&
    imageUrl.hostname === "res.cloudinary.com" &&
    !imageUrl.port &&
    !imageUrl.username &&
    !imageUrl.password &&
    !imageUrl.search &&
    !imageUrl.hash &&
    cloudinaryPath.length > 3 &&
    cloudinaryPath[2] === "image" &&
    cloudinaryPath[3] === "upload" &&
    (!cloudName || cloudinaryPath[1] === cloudName);

  if (!isCloudinaryAvatar) {
    return NextResponse.json({ error: "Unsupported image URL" }, { status: 400 });
  }

  let imageResponse: Response;
  try {
    imageResponse = await fetch(imageUrl, {
      cache: "force-cache",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return NextResponse.json({ error: "Unable to load avatar image" }, { status: 502 });
  }

  if (!imageResponse.ok || !imageResponse.body) {
    return NextResponse.json({ error: "Avatar image was not found" }, { status: 404 });
  }

  const contentType = imageResponse.headers.get("content-type")?.split(";")[0];
  const contentLength = Number(imageResponse.headers.get("content-length"));
  if (
    !contentType ||
    !ALLOWED_CONTENT_TYPES.has(contentType) ||
    (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES)
  ) {
    return NextResponse.json({ error: "Unsupported avatar image" }, { status: 415 });
  }

  const headers = new Headers({
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  });
  if (Number.isFinite(contentLength) && contentLength > 0) {
    headers.set("Content-Length", String(contentLength));
  }

  return new Response(imageResponse.body, { headers });
}
