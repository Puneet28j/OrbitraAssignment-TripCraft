import { PDFParse } from "pdf-parse";
import logger from "../logger.js";

/**
 * Extract text from a PDF buffer using pdf-parse v2 (PDFParse class).
 */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  if (!buffer?.length) {
    return "";
  }

  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text?.trim() ?? "";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ err: message }, "PDF text extraction failed");
    throw new Error(`Could not read PDF text: ${message}`);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
