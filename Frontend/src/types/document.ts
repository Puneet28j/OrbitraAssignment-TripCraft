export type DocumentStatus = "uploading" | "processing" | "ready" | "failed";
export type DocumentFileType = "pdf" | "image";

/** Document linked to a generated trip/itinerary */
export interface TripDocument {
  _id: string;
  originalName: string;
  fileName: string;
  fileType: DocumentFileType;
  mimeType: string;
  status: DocumentStatus;
  thumbnailUrl?: string | null;
  fileSize: number;
  createdAt?: string;
  viewUrl?: string;
}

/** Server-stored upload not yet linked to an itinerary */
export interface UnassignedDocument {
  _id: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  fileType: DocumentFileType;
  status: DocumentStatus;
  thumbnailUrl?: string | null;
  extractedText?: string | null;
  errorMessage?: string | null;
}

export interface DocumentStatusResponse {
  id: string;
  status: DocumentStatus;
  errorMessage?: string | null;
  hasExtractedText: boolean;
  extractedText?: string | null;
  extractionMeta?: {
    source?: "pdf-parse" | "tesseract-ocr" | "hybrid";
    charCount?: number;
    qualityScore?: number;
    processedAt?: string;
    durationMs?: number;
  } | null;
  updatedAt?: string;
}
