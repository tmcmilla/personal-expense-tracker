import "server-only";
import mongoose, { type Mongoose } from "mongoose";

const cache = (globalThis.mongooseCache ??= { conn: null, promise: null });

export async function connectToDatabase(): Promise<Mongoose> {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("Missing MONGODB_URI environment variable");
    }

    cache.promise = mongoose.connect(uri, { bufferCommands: false });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }

  return cache.conn;
}
