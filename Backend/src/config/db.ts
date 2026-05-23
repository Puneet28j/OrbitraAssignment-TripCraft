import mongoose from "mongoose";
import env from "./env.js";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

async function connectDB(): Promise<void> {
  let retries = 0;

  mongoose.connection.on("connected", () => {
    console.log("  ✓ MongoDB connected successfully");
  });

  mongoose.connection.once("open", async () => {
    try {
      const db = mongoose.connection.db;
      if (db) {
        const collection = db.collection("itineraries");
        const res = await collection.updateMany(
          { shareToken: null },
          { $unset: { shareToken: "" } }
        );
        if (res.modifiedCount > 0) {
          console.log(`  ✓ Unset null shareTokens for ${res.modifiedCount} itineraries`);
        }
      }
    } catch (err) {
      console.error("  ✗ Error migrating shareToken fields:", err);
    }
  });

  mongoose.connection.on("error", (err) => {
    console.error(`  ✗ MongoDB connection error: ${err.message}`);
  });

  mongoose.connection.on("disconnected", () => {
    console.log("  ⚠ MongoDB disconnected");
  });

  while (retries < MAX_RETRIES) {
    try {
      await mongoose.connect(env.MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      return;
    } catch (err) {
      retries += 1;
      const message = err instanceof Error ? err.message : String(err);
      const delay = RETRY_DELAY_MS * Math.pow(2, retries - 1);

      console.error(
        `  ✗ MongoDB connection attempt ${retries}/${MAX_RETRIES} failed: ${message}`
      );

      if (retries >= MAX_RETRIES) {
        console.error("  ✗ All MongoDB connection attempts exhausted. Exiting.");
        process.exit(1);
      }

      console.log(`  ↻ Retrying in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n  ${signal} received — closing MongoDB connection...`);
  try {
    await mongoose.connection.close();
    console.log("  ✓ MongoDB connection closed gracefully");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ Error closing MongoDB: ${message}`);
  }
  process.exit(0);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

export default connectDB;
