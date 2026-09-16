import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

export async function uploadImage(
  file: string,
  folder = "recycling"
): Promise<{ url: string; publicId: string }> {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    if (process.env.NODE_ENV === "development") {
      return { url: file, publicId: "dev-local" };
    }
    throw new Error("Cloudinary is not configured");
  }

  const result = await cloudinary.uploader.upload(file, {
    folder: `community-recycling/${folder}`,
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  });

  return { url: result.secure_url, publicId: result.public_id };
}

export async function deleteImage(publicId: string) {
  if (publicId === "dev-local") return;
  await cloudinary.uploader.destroy(publicId);
}
