import type { IDocumentDocument } from "../../models/Document.js";
import ApiError from "../../shared/errors/ApiError.js";

export interface DocumentForAI {
  id: string;
  originalName: string;
  fileType: "pdf" | "image";
  text: string;
}

/** Preserve client order and ensure every selected document has extracted text. */
export function prepareDocumentsForAI(
  documentIds: string[],
  documents: IDocumentDocument[]
): DocumentForAI[] {
  const byId = new Map(
    documents.map((doc) => [String(doc._id), doc] as const)
  );

  const ordered: DocumentForAI[] = [];
  const missingText: string[] = [];

  for (const id of documentIds) {
    const doc = byId.get(id);
    if (!doc) continue;

    const text = doc.extractedText?.trim() ?? "";
    if (!text) {
      missingText.push(doc.originalName);
      continue;
    }

    ordered.push({
      id: String(doc._id),
      originalName: doc.originalName,
      fileType: doc.fileType,
      text,
    });
  }

  if (missingText.length > 0) {
    throw ApiError.badRequest(
      `No extracted text for: ${missingText.join(", ")}. Wait for extraction to finish or re-upload.`
    );
  }

  if (ordered.length !== documentIds.length) {
    throw ApiError.badRequest(
      "Could not load all selected documents for itinerary generation."
    );
  }

  return ordered;
}
