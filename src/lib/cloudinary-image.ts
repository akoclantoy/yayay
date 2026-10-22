export function getCloudinaryImageProxySrc(
  imageSrc: string | null | undefined,
): string | undefined {
  if (!imageSrc) return undefined;

  let imageUrl: URL;
  try {
    imageUrl = new URL(imageSrc);
  } catch {
    return imageSrc;
  }

  const path = imageUrl.pathname.split("/");
  const isCloudinaryImage =
    imageUrl.protocol === "https:" &&
    imageUrl.hostname === "res.cloudinary.com" &&
    !imageUrl.port &&
    !imageUrl.username &&
    !imageUrl.password &&
    !imageUrl.search &&
    !imageUrl.hash &&
    path.length > 3 &&
    path[2] === "image" &&
    path[3] === "upload";

  return isCloudinaryImage
    ? `/api/media/cloudinary-avatar?url=${encodeURIComponent(imageSrc)}`
    : imageSrc;
}
