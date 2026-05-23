import app from "./app.js";
import connectDB from "./config/db.js";
import env from "./config/env.js";
import logger from "./shared/logger.js";
import {
  terminateOcrWorker,
  warmupOcrWorker,
} from "./shared/ocr/tesseract.util.js";
import type { Server } from "node:http";

let server: Server | undefined;

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "UNCAUGHT EXCEPTION — Server shutting down");
  process.exit(1);
});

async function startServer() {
  logger.info("Initializing TripCraft Server...");

  await connectDB();
  void warmupOcrWorker();

  server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      `Server running on port ${env.PORT}`
    );
    logger.info(`API URL: http://localhost:${env.PORT}/api/v1`);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down");
    await terminateOcrWorker();
    if (server) {
      server.close(() => process.exit(0));
    } else {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  process.on("unhandledRejection", (err: unknown) => {
    logger.error({ err }, "UNHANDLED REJECTION — Shutting down gracefully");

    if (server) {
      server.close(() => {
        logger.info("Server connections terminated. Exiting.");
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  });
}

void startServer();
