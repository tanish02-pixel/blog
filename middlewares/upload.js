import multer from "multer";
import { storage } from "../cloudinary.js"; // ✅ correct

export const upload = multer({ storage });
