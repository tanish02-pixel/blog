import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config(); // Load variables from .env

const uri = process.env.MONGO_URI;

const connectDB = async () => {
  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected ✅");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
  }
};

export default connectDB;
