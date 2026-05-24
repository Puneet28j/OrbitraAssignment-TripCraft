import mongoose, { type Document, type Model, type Types } from "mongoose";

export const FILE_TYPES = ["pdf", "image"] as const;
export const DOCUMENT_STATUSES = [
  "uploading",
  "processing",
  "ready",
  "failed",
] as const;

export type FileType = (typeof FILE_TYPES)[number];
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export interface IDocument {
  userId: Types.ObjectId;
  fileName: string;
  originalName: string;
  fileType: FileType;
  mimeType: string;
  fileSize: number;
  cloudinaryUrl: string;
  publicId: string;
  resourceType: "raw" | "image";
  thumbnailUrl?: string | null;
  extractedText?: string | null;
  status: DocumentStatus;
  errorMessage?: string | null;
  extractionMeta?: {
    source?: "pdf-parse" | "tesseract-ocr" | "hybrid";
    voucherCount?: number;
    charCount?: number;
    fingerprint?: string | null;
    duplicateOf?: Types.ObjectId | null;
    barcodeDetections?: Array<{
      type: string;
      data: string;
      format: string;
      bbox?: { x: number; y: number; width: number; height: number };
    }>;
    classificationConfidence?: number;
    extractionIssues?: string[];
    qualityScore?: number;
    structuredFacts?: Record<string, unknown> | null;
    processedAt?: Date;
    durationMs?: number;
  } | null;
}

export interface IDocumentDocument extends IDocument, Document {}

export interface IDocumentModel extends Model<IDocumentDocument> {}

const documentSchema = new mongoose.Schema<IDocumentDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    fileName: {
      type: String,
      required: [true, "File name is required"],
      trim: true,
    },
    originalName: {
      type: String,
      required: [true, "Original file name is required"],
      trim: true,
    },
    fileType: {
      type: String,
      required: [true, "File type is required"],
      enum: {
        values: FILE_TYPES,
        message: "File type must be one of: pdf, image",
      },
    },
    mimeType: {
      type: String,
      required: [true, "MIME type is required"],
      trim: true,
    },
    fileSize: {
      type: Number,
      required: [true, "File size is required"],
      min: [0, "File size cannot be negative"],
    },
    cloudinaryUrl: {
      type: String,
      required: [true, "Cloudinary URL is required"],
    },
    publicId: {
      type: String,
      required: [true, "Cloudinary public ID is required"],
    },
    resourceType: {
      type: String,
      required: [true, "Resource type is required"],
      enum: ["raw", "image"],
    },
    thumbnailUrl: {
      type: String,
      default: null,
    },
    extractedText: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: DOCUMENT_STATUSES,
        message: "Status must be one of: uploading, processing, ready, failed",
      },
      default: "uploading",
    },
    errorMessage: {
      type: String,
      default: null,
    },
    extractionMeta: {
      source: {
        type: String,
        enum: ["pdf-parse", "tesseract-ocr", "hybrid"],
      },
      voucherCount: { type: Number },
      charCount: { type: Number },
      fingerprint: { type: String, index: true },
      duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: "Document" },
      classificationConfidence: { type: Number },
      barcodeDetections: { type: mongoose.Schema.Types.Mixed, default: undefined },
      extractionIssues: { type: [String], default: undefined },
      qualityScore: { type: Number },
      structuredFacts: { type: mongoose.Schema.Types.Mixed, default: null },
      processedAt: { type: Date },
      durationMs: { type: Number },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

documentSchema.index({ userId: 1, createdAt: -1 });

const DocumentModel = mongoose.model<IDocumentDocument, IDocumentModel>(
  "Document",
  documentSchema
);

export default DocumentModel;
