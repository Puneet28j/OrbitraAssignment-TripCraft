import { ZodError, type z } from "zod";
import type { Request, Response } from "express";
import type { Types } from "mongoose";
import Document, {
  type IDocumentDocument,
  type FileType,
} from "../../models/Document.js";
import Itinerary from "../../models/Itinerary.js";
import * as cloudinaryService from "./cloudinary.service.js";
import {
  enqueueExtraction,
  enqueueExtractions,
} from "./extraction.service.js";
import ApiResponse from "../../shared/http/ApiResponse.js";
import ApiError from "../../shared/errors/ApiError.js";
import asyncHandler from "../../shared/middleware/asyncHandler.js";
import {
  uploadMetadataSchema,
  uploadBatchMetadataSchema,
} from "./upload.schema.js";

interface CreateDocumentInput {
  userId: Types.ObjectId;
  fileName: string;
  originalName: string;
  fileType: FileType;
  mimeType: string;
  fileSize: number;
  cloudinaryUrl: string;
  publicId: string;
  resourceType: "raw" | "image";
  thumbnailUrl: string;
}

function assertPublicIdOwnedByUser(
  publicId: string,
  userId: Types.ObjectId | string
): void {
  const expectedPrefix = `tripcraft/${String(userId)}/`;
  if (!publicId.startsWith(expectedPrefix)) {
    throw ApiError.forbidden(
      "Public ID must belong to your upload folder"
    );
  }
}

const createDocumentRecord = async (
  input: CreateDocumentInput,
  options?: { enqueue?: boolean }
): Promise<IDocumentDocument> => {
  const doc = await Document.create({
    ...input,
    status: "processing",
  });

  if (options?.enqueue !== false) {
    enqueueExtraction(doc._id);
  }
  return doc;
};

async function persistMetadataBatch(
  userId: Types.ObjectId,
  items: z.infer<typeof uploadMetadataSchema>[]
): Promise<IDocumentDocument[]> {
  const created: IDocumentDocument[] = [];

  for (const metadata of items) {
    assertPublicIdOwnedByUser(metadata.publicId, userId);

    const thumbnailUrl = cloudinaryService.getThumbnailUrl(
      metadata.publicId,
      metadata.fileType
    );

    const doc = await createDocumentRecord(
      {
        userId,
        fileName: metadata.fileName,
        originalName: metadata.originalName,
        fileType: metadata.fileType,
        mimeType: metadata.mimeType,
        fileSize: metadata.fileSize,
        cloudinaryUrl: metadata.cloudinaryUrl,
        publicId: metadata.publicId,
        resourceType: metadata.resourceType,
        thumbnailUrl,
      },
      { enqueue: false }
    );

    created.push(doc);
  }

  enqueueExtractions(created.map((d) => d._id));
  return created;
}

export const saveDocumentsBatch = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Not authenticated");
    }

    const { documents: metadataList } = req.body as z.infer<
      typeof uploadBatchMetadataSchema
    >;

    const documents = await persistMetadataBatch(
      req.user._id,
      metadataList
    );

    ApiResponse.created("Documents saved successfully", documents).send(res);
  }
);

export const getUploadSignature = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Not authenticated");
    }

    const { resourceType = "image" } = req.body as {
      resourceType?: "image" | "raw";
    };
    const folder = `tripcraft/${req.user._id}/documents`;

    const signParams = cloudinaryService.getSignedUploadParams(
      folder,
      resourceType
    );

    ApiResponse.ok("Upload signature generated successfully", signParams).send(
      res
    );
  }
);

export const uploadDocuments = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Not authenticated");
    }

    const documents: IDocumentDocument[] = [];
    const userId = req.user._id;

    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const created = await Promise.all(
        req.files.map(async (file) => {
          const isPDF = file.mimetype === "application/pdf";
          const fileType: FileType = isPDF ? "pdf" : "image";
          const resourceType = isPDF ? "raw" : "image";
          const folder = `tripcraft/${userId}/documents`;

          const uploadResult = await cloudinaryService.uploadBuffer(
            file.buffer,
            { folder, resourceType }
          );

          const thumbnailUrl = cloudinaryService.getThumbnailUrl(
            uploadResult.publicId,
            fileType
          );

          return createDocumentRecord(
            {
              userId,
              fileName: file.fieldname || file.originalname,
              originalName: file.originalname,
              fileType,
              mimeType: file.mimetype,
              fileSize: file.size,
              cloudinaryUrl: uploadResult.url,
              publicId: uploadResult.publicId,
              resourceType,
              thumbnailUrl,
            },
            { enqueue: false }
          );
        })
      );

      documents.push(...created);
      enqueueExtractions(created.map((d) => d._id));
    } else if (
      req.body?.documents &&
      Array.isArray(req.body.documents)
    ) {
      let parsed;
      try {
        parsed = uploadBatchMetadataSchema.parse(req.body);
      } catch (parseError) {
        if (parseError instanceof ZodError) {
          const errors = parseError.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          }));
          throw ApiError.validation("Invalid batch document metadata", errors);
        }
        throw ApiError.validation("Invalid batch document metadata");
      }

      documents.push(...(await persistMetadataBatch(userId, parsed.documents)));
    } else if (req.body && (req.body.cloudinaryUrl || req.body.url)) {
      const cloudinaryUrl = (req.body.cloudinaryUrl || req.body.url) as string;

      let metadata;
      try {
        metadata = uploadMetadataSchema.parse({
          ...req.body,
          cloudinaryUrl,
        });
      } catch (parseError) {
        if (parseError instanceof ZodError) {
          const errors = parseError.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          }));
          throw ApiError.validation("Invalid document metadata", errors);
        }
        throw ApiError.validation("Invalid document metadata");
      }

      const [doc] = await persistMetadataBatch(userId, [metadata]);
      documents.push(doc);
    } else {
      throw ApiError.badRequest("No files or document metadata provided");
    }

    ApiResponse.created("Documents uploaded successfully", documents).send(res);
  }
);

export const getDocuments = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized("Not authenticated");
  }

  const page = parseInt(String(req.query.page), 10) || 1;
  const limit = parseInt(String(req.query.limit), 10) || 10;
  const skip = (page - 1) * limit;

  const total = await Document.countDocuments({ userId: req.user._id });
  const docs = await Document.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  ApiResponse.ok("Documents retrieved successfully", docs, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  }).send(res);
});

/** Documents uploaded but not yet linked to any itinerary (draft upload session). */
export const getUnassignedDocuments = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Not authenticated");
    }

    const itineraries = await Itinerary.find(
      { userId: req.user._id, isDeleted: false },
      "documentIds"
    ).lean();

    const assignedIds: Types.ObjectId[] = [];
    for (const itinerary of itineraries) {
      for (const docId of itinerary.documentIds ?? []) {
        assignedIds.push(docId as Types.ObjectId);
      }
    }

    const filter: Record<string, unknown> = { userId: req.user._id };
    if (assignedIds.length > 0) {
      filter._id = { $nin: assignedIds };
    }

    const docs = await Document.find(filter)
      .sort({ createdAt: -1 })
      .limit(30);

    ApiResponse.ok("Unassigned documents retrieved successfully", docs).send(
      res
    );
  }
);

export const getDocumentViewUrl = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Not authenticated");
    }

    const { id } = req.params;
    const doc = await Document.findOne(
      { _id: id, userId: req.user._id },
      "originalName fileType publicId resourceType"
    );

    if (!doc) {
      throw ApiError.notFound("Document not found or access denied");
    }

    const viewUrl = cloudinaryService.getSignedViewUrl(
      doc.publicId,
      doc.resourceType,
      doc.fileType
    );

    ApiResponse.ok("Document view URL generated", {
      id: doc._id,
      originalName: doc.originalName,
      fileType: doc.fileType,
      viewUrl,
    }).send(res);
  }
);

/** Stream document bytes for in-app preview (PDF iframe / image). */
export const streamDocumentContent = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Not authenticated");
    }

    const { id } = req.params;
    const doc = await Document.findOne({ _id: id, userId: req.user._id });

    if (!doc) {
      throw ApiError.notFound("Document not found or access denied");
    }

    const buffer = await cloudinaryService.downloadAssetBuffer({
      publicId: doc.publicId,
      resourceType: doc.resourceType,
      fileType: doc.fileType,
      cloudinaryUrl: doc.cloudinaryUrl,
    });

    const contentType =
      doc.fileType === "pdf"
        ? "application/pdf"
        : doc.mimeType || "application/octet-stream";

    const safeName = doc.originalName.replace(/[^\w.\-() ]+/g, "_");

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(safeName)}"`
    );
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(buffer);
  }
);

export const getDocumentStatus = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Not authenticated");
    }

    const { id } = req.params;
    const doc = await Document.findOne(
      { _id: id, userId: req.user._id },
      "status errorMessage extractedText extractionMeta updatedAt"
    );

    if (!doc) {
      throw ApiError.notFound("Document not found or access denied");
    }

    ApiResponse.ok("Document status retrieved", {
      id: doc._id,
      status: doc.status,
      errorMessage: doc.errorMessage,
      hasExtractedText: Boolean(doc.extractedText),
      extractedText:
        doc.status === "ready" ? (doc.extractedText ?? null) : null,
      extractionMeta: doc.extractionMeta,
      updatedAt: (doc as { updatedAt?: Date }).updatedAt,
    }).send(res);
  }
);

export const deleteDocument = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Not authenticated");
    }

    const { id } = req.params;

    const doc = await Document.findOne({ _id: id, userId: req.user._id });
    if (!doc) {
      throw ApiError.notFound("Document not found or access denied");
    }

    await cloudinaryService.deleteFile(doc.publicId, doc.resourceType);
    await doc.deleteOne();

    ApiResponse.ok("Document deleted successfully").send(res);
  }
);
