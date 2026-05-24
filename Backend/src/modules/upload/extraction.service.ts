import Document from "../../models/Document.js";
import ApiError from "../../shared/errors/ApiError.js";
import { extractTextFromPdfBuffer } from "../../shared/ocr/pdf.util.js";
import { extractTextFromImageBufferRobust } from "../../shared/ocr/tesseract.util.js";
import {
  isUsableExtractedText,
  scoreExtractedText,
  MIN_TEXT_QUALITY_SCORE,
} from "../../shared/ocr/textQuality.util.js";
import {
  extractTravelFacts,
  mergeBarcodeIntoFacts,
} from "../ai/travelFacts.util.js";
import type { TravelFacts } from "../ai/travelFacts.types.js";
import { computeDocumentFingerprint } from "../../shared/ocr/fingerprint.util.js";
import { decodeBarcodesFromBuffer } from "../../shared/ocr/barcodeDecoder.util.js";
import * as cloudinaryService from "./cloudinary.service.js";
import { runPool } from "../../shared/utils/runPool.js";
import env from "../../config/env.js";
import logger from "../../shared/logger.js";
import type { Types } from "mongoose";

export type ExtractionSource = "pdf-parse" | "tesseract-ocr" | "hybrid";

/* ── Queue ──────────────────────────────────────────── */

const pendingIds: Types.ObjectId[] = [];
let isDraining = false;

export function enqueueExtraction(documentId: Types.ObjectId | string) {
  enqueueExtractions([documentId as Types.ObjectId]);
}

export function enqueueExtractions(
  documentIds: Array<Types.ObjectId | string>
) {
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

function fingerprintSummaryFromFacts(facts: TravelFacts): string {
  return JSON.stringify({
    kind: facts.documentKind,
    hotels: facts.hotels.map((h) =>
      [h.hotel, h.checkIn, h.checkOut, h.hotelConfirmation].join("|")
    ),
    flights: facts.flights.map((f) =>
      [f.from, f.to, f.flightNumber, f.pnr, f.date].join("|")
    ),
    trains: facts.trains.map((t) =>
      [t.from, t.to, t.trainNumber, t.date].join("|")
    ),
    refs: facts.bookingRefs.slice(0, 6),
  });
}

/* ── OCR / PDF text extraction ─────────────────────── */

async function extractTextFromDocument(
  fileType: "pdf" | "image",
  doc: {
    cloudinaryUrl: string;
    publicId: string;
    resourceType: "raw" | "image";
  }
): Promise<{
  text: string;
  source: ExtractionSource;
  qualityScore: number;
  buffer: Buffer;
}> {
  const buffer = await cloudinaryService.downloadAssetBuffer({
    publicId: doc.publicId,
    resourceType: doc.resourceType,
    fileType,
    cloudinaryUrl: doc.cloudinaryUrl,
  });

  if (fileType === "pdf") {
    const pdfResult = await extractTextFromPdfBuffer(buffer);
    return { ...pdfResult, buffer };
  }

  const text = await extractTextFromImageBufferRobust(buffer);
  return {
    text,
    source: "tesseract-ocr",
    qualityScore: scoreExtractedText(text),
    buffer,
  };
}

/* ── Main extraction pipeline (single pass) ────────── */

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

    const { text, source, qualityScore, buffer } =
      await extractTextFromDocument(doc.fileType, {
        cloudinaryUrl: doc.cloudinaryUrl,
        publicId: doc.publicId,
        resourceType: doc.resourceType,
      });

    if (!isUsableExtractedText(text)) {
      throw new ApiError(
        422,
        "Could not read enough text from this file. Upload a clearer photo or a text-based PDF."
      );
    }

    let structuredFacts = extractTravelFacts(text);

    const barcodeDetections = await decodeBarcodesFromBuffer(
      buffer,
      doc.fileType
    ).catch(() => []);

    if (barcodeDetections.length > 0) {
      structuredFacts = mergeBarcodeIntoFacts(
        structuredFacts,
        barcodeDetections.map((d) => d.data)
      );
    }

    const extractionIssues: string[] = [];

    if (qualityScore < MIN_TEXT_QUALITY_SCORE) {
      extractionIssues.push(
        `Low text quality (${Math.round(qualityScore)}). Consider uploading a clearer image.`
      );
    }

    const fingerprint = computeDocumentFingerprint(
      fingerprintSummaryFromFacts(structuredFacts)
    );
    const existing = await Document.findOne({
      userId: doc.userId,
      "extractionMeta.fingerprint": fingerprint,
      _id: { $ne: documentId },
    }).select("_id");
    const duplicateOf = existing ? existing._id : undefined;

    await Document.findByIdAndUpdate(documentId, {
      extractedText: text,
      status: "ready",
      errorMessage: null,
      extractionMeta: {
        source,
        charCount: text.length,
        qualityScore,
        fingerprint,
        duplicateOf,
        classificationConfidence:
          structuredFacts.classificationConfidence ?? null,
        extractionIssues: extractionIssues.length ? extractionIssues : undefined,
        structuredFacts,
        barcodeDetections: barcodeDetections.length
          ? barcodeDetections
          : undefined,
        voucherCount:
          structuredFacts.voucherCount ?? structuredFacts.hotels.length,
        processedAt: new Date(),
        durationMs: Date.now() - startedAt,
      },
    });

    logger.info(
      {
        documentId,
        source,
        kind: structuredFacts.documentKind,
        charCount: text.length,
        barcodes: barcodeDetections.length,
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
