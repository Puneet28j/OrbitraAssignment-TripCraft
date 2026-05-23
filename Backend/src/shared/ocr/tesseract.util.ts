import { createWorker, type Worker } from "tesseract.js";
import sharp from "sharp";
import logger from "../logger.js";

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      logger.info("Initializing Tesseract OCR worker");
      const worker = await createWorker("eng", undefined, {
        logger: () => undefined,
      });
      return worker;
    })();
  }
  return workerPromise;
}

/**
 * Preprocess image for better OCR: auto-rotate, grayscale, normalize, cap size.
 */
export async function preprocessImageForOcr(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .grayscale()
    .normalize()
    .resize({
      width: 2400,
      height: 2400,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
}

export async function extractTextFromImageBuffer(
  buffer: Buffer
): Promise<string> {
  const preprocessed = await preprocessImageForOcr(buffer);
  const worker = await getWorker();
  const {
    data: { text },
  } = await worker.recognize(preprocessed);
  return text?.trim() ?? "";
}

/** Load OCR worker at startup so first image upload is faster. */
export async function warmupOcrWorker(): Promise<void> {
  try {
    await getWorker();
    logger.info("Tesseract OCR worker ready");
  } catch (error) {
    logger.warn({ err: error }, "Tesseract warmup failed; will retry on first OCR");
  }
}

export async function terminateOcrWorker(): Promise<void> {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
    logger.info("Tesseract OCR worker terminated");
  }
}
