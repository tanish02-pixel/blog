// cloudinary.js (✅ ESM Compatible)
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "blog_images", // change to any folder you like
    allowed_formats: ["jpeg", "png", "jpg", "webp"],
    transformation: [{ width: 800, height: 600, crop: "limit" }]
  }
});
