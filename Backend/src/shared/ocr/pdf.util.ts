import { PDFParse } from "pdf-parse";
import logger from "../logger.js";
import { mapPool } from "../utils/runPool.js";
import { extractTextFromImageBufferRobust } from "./tesseract.util.js";
import {
  isUsableExtractedText,
  pickBestExtractedText,
  scoreExtractedText,
} from "./textQuality.util.js";
import { isFastExtraction } from "./extractionMode.js";

export type PdfExtractionSource = "pdf-parse" | "tesseract-ocr" | "hybrid";

export interface PdfExtractionResult {
  text: string;
  source: PdfExtractionSource;
  qualityScore: number;
}

const MAX_PDF_PAGES = 20;
const PDF_PAGE_CONCURRENCY = 2;
const OCR_RENDER_SCALE = isFastExtraction() ? 2 : 2.5;
const OCR_HIGH_RES_SCALE = 3.5;

type PageMethod = "pdf-parse" | "tesseract-ocr";

interface PageExtraction {
  text: string;
  method: PageMethod;
}

async function ocrPdfPage(
  parser: PDFParse,
  pageNum: number,
  scale: number
): Promise<string> {
  const screenshot = await parser.getScreenshot({
    scale,
    partial: [pageNum],
    imageBuffer: true,
    imageDataUrl: false,
  });

  const pageShot = screenshot.pages[0];
  if (!pageShot?.data?.length) return "";

  return extractTextFromImageBufferRobust(Buffer.from(pageShot.data));
}

async function extractPdfPage(
  parser: PDFParse,
  pageNum: number
): Promise<PageExtraction> {
  const textResult = await parser.getText({
    partial: [pageNum],
    pageJoiner: "",
  });
  const layerText = textResult.pages[0]?.text?.trim() ?? "";

  if (isUsableExtractedText(layerText)) {
    return { text: layerText, method: "pdf-parse" };
  }

  let ocrText = await ocrPdfPage(parser, pageNum, OCR_RENDER_SCALE);

  if (!isFastExtraction() && !isUsableExtractedText(ocrText)) {
    const highResText = await ocrPdfPage(parser, pageNum, OCR_HIGH_RES_SCALE);
    ocrText = pickBestExtractedText([
      { text: ocrText, label: "standard" },
      { text: highResText, label: "high-res" },
    ]);
  }

  const best = pickBestExtractedText([
    { text: layerText, label: "layer" },
    { text: ocrText, label: "ocr" },
  ]);

  const method: PageMethod =
    scoreExtractedText(ocrText) > scoreExtractedText(layerText)
      ? "tesseract-ocr"
      : "pdf-parse";

  return { text: best, method };
}

function resolvePdfSource(methods: PageMethod[]): PdfExtractionSource {
  const unique = new Set(methods);
  if (unique.size > 1) return "hybrid";
  return unique.has("tesseract-ocr") ? "tesseract-ocr" : "pdf-parse";
}

/**
 * Robust PDF extraction: per-page text layer with OCR fallback and quality scoring.
 */
export async function extractTextFromPdfBuffer(
  buffer: Buffer
): Promise<PdfExtractionResult> {
  if (!buffer?.length) {
    return { text: "", source: "pdf-parse", qualityScore: 0 };
  }

  const parser = new PDFParse({ data: buffer });

  try {
    const info = await parser.getInfo();
    const pageCount = Math.min(Math.max(info.total ?? 1, 1), MAX_PDF_PAGES);
    const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1);

    const pageResults = await mapPool(
      pageNumbers,
      PDF_PAGE_CONCURRENCY,
      (pageNum) => extractPdfPage(parser, pageNum)
    );

    const text = pageResults
      .map((page) => page.text)
      .filter(Boolean)
      .join("\n\n")
      .trim();

    const qualityScore = scoreExtractedText(text);
    const source = resolvePdfSource(pageResults.map((p) => p.method));

    if (!isUsableExtractedText(text)) {
      logger.warn(
        { qualityScore, pageCount, source },
        "PDF extraction quality below threshold"
      );
    } else {
      logger.info(
        { qualityScore, pageCount, source, charCount: text.length },
        "PDF extraction complete"
      );
    }

    return { text, source, qualityScore };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ err: message }, "PDF text extraction failed");
    throw new Error(`Could not read PDF text: ${message}`);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
