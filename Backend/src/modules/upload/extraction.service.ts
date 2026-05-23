import Document from "../../models/Document.js";
import ApiError from "../../shared/errors/ApiError.js";
import { extractTextFromPdfBuffer } from "../../shared/ocr/pdf.util.js";
import { extractTextFromImageBuffer } from "../../shared/ocr/tesseract.util.js";
import * as cloudinaryService from "./cloudinary.service.js";
import { runPool } from "../../shared/utils/runPool.js";
import env from "../../config/env.js";
import logger from "../../shared/logger.js";
import type { Types } from "mongoose";

export type ExtractionSource = "pdf-parse" | "tesseract-ocr";

const pendingIds: Types.ObjectId[] = [];
let isDraining = false;

export function enqueueExtraction(documentId: Types.ObjectId | string) {
  enqueueExtractions([documentId as Types.ObjectId]);
}

export function enqueueExtractions(documentIds: Array<Types.ObjectId | string>) {
  for (const id of documentIds) {
    pendingIds.push(id as Types.ObjectId);
  }
  scheduleDrain();
}

function scheduleDrain() {
  if (isDraining) return;
  isDraining = true;
  setImmediate(() => {
    void drainQueue();
  });
}

async function drainQueue() {
  const batch = pendingIds.splice(0, pendingIds.length);
  isDraining = false;

  if (batch.length === 0) return;

  logger.info(
    { count: batch.length, concurrency: env.EXTRACTION_CONCURRENCY },
    "Starting extraction batch"
  );

  await runPool(batch, env.EXTRACTION_CONCURRENCY, async (documentId) => {
    try {
      await extractDocumentTextInBackground(documentId);
    } catch (error) {
      logger.error({ documentId, err: error }, "Extraction job failed");
    }
  });

  if (pendingIds.length > 0) {
    scheduleDrain();
  }
}

async function extractTextFromDocument(
  fileType: "pdf" | "image",
  doc: {
    cloudinaryUrl: string;
    publicId: string;
    resourceType: "raw" | "image";
  }
): Promise<{ text: string; source: ExtractionSource }> {
  const buffer = await cloudinaryService.downloadAssetBuffer({
    publicId: doc.publicId,
    resourceType: doc.resourceType,
    fileType,
    cloudinaryUrl: doc.cloudinaryUrl,
  });

  if (fileType === "pdf") {
    const text = await extractTextFromPdfBuffer(buffer);
    return { text, source: "pdf-parse" };
  }

  const text = await extractTextFromImageBuffer(buffer);
  return { text, source: "tesseract-ocr" };
}

export async function extractDocumentTextInBackground(
  documentId: Types.ObjectId | string
): Promise<void> {
  const doc = await Document.findById(documentId);
  if (!doc) return;

  const startedAt = Date.now();

  try {
    await Document.findByIdAndUpdate(documentId, {
      status: "processing",
      errorMessage: null,
    });

    const { text, source } = await extractTextFromDocument(doc.fileType, {
      cloudinaryUrl: doc.cloudinaryUrl,
      publicId: doc.publicId,
      resourceType: doc.resourceType,
    });

    if (!text || text.length < 10) {
      throw new ApiError(
        422,
        "No readable text was found. Use a clearer scan or a text-based PDF."
      );
    }

    await Document.findByIdAndUpdate(documentId, {
      extractedText: text,
      status: "ready",
      errorMessage: null,
      extractionMeta: {
        source,
        charCount: text.length,
        processedAt: new Date(),
        durationMs: Date.now() - startedAt,
      },
    });

    logger.info(
      {
        documentId,
        source,
        charCount: text.length,
        durationMs: Date.now() - startedAt,
      },
      "Document extraction complete"
    );
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unknown extraction error";

    logger.error(
      { documentId, err: message, durationMs: Date.now() - startedAt },
      "Document extraction failed"
    );

    await Document.findByIdAndUpdate(documentId, {
      status: "failed",
      errorMessage: message,
      extractionMeta: {
        processedAt: new Date(),
        durationMs: Date.now() - startedAt,
      },
    });
  }
}
