import { createWorker, PSM, type Worker } from "tesseract.js";
import sharp from "sharp";
import logger from "../logger.js";
import { pickBestExtractedText } from "./textQuality.util.js";

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      logger.info("Initializing Tesseract OCR worker");
      const worker = await createWorker("eng", undefined, {
        logger: () => undefined,
      });
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
      });
      return worker;
    })();
  }
  return workerPromise;
}

/** Standard pipeline for photos and screenshots. */
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

/** Sharper pipeline for scanned PDF pages and low-contrast tickets. */
async function preprocessDocumentScanForOcr(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1.2 })
    .resize({
      width: 2800,
      height: 2800,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
}

async function recognizePreprocessed(
  worker: Worker,
  imageBuffer: Buffer,
  psm: PSM
): Promise<string> {
  await worker.setParameters({ tessedit_pageseg_mode: psm });
  const {
    data: { text },
  } = await worker.recognize(imageBuffer);
  return text?.trim() ?? "";
}

/**
 * Run multiple OCR passes with different preprocessing and page segmentation,
 * then return the highest-quality result.
 */
export async function extractTextFromImageBufferRobust(
  buffer: Buffer
): Promise<string> {
  if (!buffer?.length) return "";

  const worker = await getWorker();
  const passes: Array<{ preprocess: (b: Buffer) => Promise<Buffer>; psm: PSM }> =
    [
      { preprocess: preprocessImageForOcr, psm: PSM.AUTO },
      { preprocess: preprocessDocumentScanForOcr, psm: PSM.SINGLE_BLOCK },
      { preprocess: preprocessDocumentScanForOcr, psm: PSM.SPARSE_TEXT },
    ];

  const candidates: Array<{ text: string; label: string }> = [];

  for (const pass of passes) {
    try {
      const preprocessed = await pass.preprocess(buffer);
      const text = await recognizePreprocessed(worker, preprocessed, pass.psm);
      if (text) {
        candidates.push({ text, label: `psm-${pass.psm}` });
      }
    } catch (error) {
      logger.warn({ err: error, psm: pass.psm }, "OCR pass failed");
    }
  }

  const best = pickBestExtractedText(candidates);
  if (best) return best;

  return candidates[0]?.text ?? "";
}

/** @deprecated Use extractTextFromImageBufferRobust — kept as alias. */
export async function extractTextFromImageBuffer(
  buffer: Buffer
): Promise<string> {
  return extractTextFromImageBufferRobust(buffer);
}

/** Load OCR worker at startup so first image upload is faster. */
export async function warmupOcrWorker(): Promise<void> {
  try {
    await getWorker();
    logger.info("Tesseract OCR worker ready");
  } catch (error) {
    logger.warn(
      { err: error },
      "Tesseract warmup failed; will retry on first OCR"
    );
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
