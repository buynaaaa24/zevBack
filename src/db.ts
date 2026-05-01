import mongoose from "mongoose";

export async function connectMongo(): Promise<void> {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/zevtabs";
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
}
