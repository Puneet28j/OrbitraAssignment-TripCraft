import type { Request, Response } from "express";
import Itinerary from "../../models/Itinerary.js";
import Document from "../../models/Document.js";
import * as aiService from "../ai/ai.service.js";
import { generateUniqueShareToken } from "./shareToken.util.js";
import {
  attachDocumentsToItineraries,
  attachDocumentsToItinerary,
} from "./itineraryDocuments.util.js";
import ApiResponse from "../../shared/http/ApiResponse.js";
import ApiError from "../../shared/errors/ApiError.js";
import asyncHandler from "../../shared/middleware/asyncHandler.js";
import env from "../../config/env.js";
import type { z } from "zod";
import type { listItineraryQuerySchema } from "./itinerary.schema.js";

type ListItineraryQuery = z.infer<typeof listItineraryQuerySchema>;

export const generateItinerary = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Not authenticated");
    }

    const { documentIds } = req.body as { documentIds: string[] };

    if (!documentIds?.length) {
      throw ApiError.badRequest(
        "A non-empty array of document IDs is required"
      );
    }

    const documents = await Document.find({
      _id: { $in: documentIds },
      userId: req.user._id,
    });

    if (documents.length !== documentIds.length) {
      throw ApiError.notFound(
        "One or more documents could not be found or access is denied"
      );
    }

    const notReadyDocs = documents.filter((doc) => doc.status !== "ready");
    if (notReadyDocs.length > 0) {
      throw ApiError.badRequest(
        `Some documents are not ready for generation. Statuses: ${notReadyDocs
          .map((d) => `${d.originalName} (${d.status})`)
          .join(", ")}`
      );
    }

    const documentTexts = documents
      .map((doc) => doc.extractedText)
      .filter((text): text is string => !!text && text.trim().length > 0);

    if (documentTexts.length === 0) {
      throw ApiError.badRequest(
        "No text content extracted from the provided documents"
      );
    }

    const aiResult = await aiService.generateItinerary(documentTexts);

    const parsedStartDate = aiResult.startDate
      ? new Date(aiResult.startDate)
      : null;
    const parsedEndDate = aiResult.endDate ? new Date(aiResult.endDate) : null;

    const itinerary = await Itinerary.create({
      userId: req.user._id,
      documentIds,
      title: aiResult.title || "My Trip Itinerary",
      destination: aiResult.destination || "Unknown Destination",
      startDate:
        parsedStartDate && !isNaN(parsedStartDate.getTime())
          ? parsedStartDate
          : null,
      endDate:
        parsedEndDate && !isNaN(parsedEndDate.getTime()) ? parsedEndDate : null,
      summary: aiResult.summary || "",
      days: aiResult.days || [],
    });

    const itineraryWithDocuments = await attachDocumentsToItinerary(itinerary);

    ApiResponse.created(
      "Itinerary generated successfully",
      itineraryWithDocuments
    ).send(res);
  }
);

export const getItineraries = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Not authenticated");
    }

    const query = req.validatedQuery as ListItineraryQuery;
    const page = query.page;
    const limit = query.limit;
    const sort = query.sort === "oldest" ? 1 : -1;
    const skip = (page - 1) * limit;

    const filter = { userId: req.user._id, isDeleted: false };

    const total = await Itinerary.countDocuments(filter);
    const itineraries = await Itinerary.find(filter)
      .sort({ createdAt: sort })
      .skip(skip)
      .limit(limit);

    const itinerariesWithDocuments = await attachDocumentsToItineraries(
      itineraries
    );

    ApiResponse.ok(
      "Itineraries retrieved successfully",
      itinerariesWithDocuments,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    ).send(res);
  }
);

export const getItineraryById = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Not authenticated");
    }

    const { id } = req.params;

    const itinerary = await Itinerary.findOne({
      _id: id,
      userId: req.user._id,
      isDeleted: false,
    });

    if (!itinerary) {
      throw ApiError.notFound("Itinerary not found or access is denied");
    }

    const itineraryWithDocuments = await attachDocumentsToItinerary(itinerary);

    ApiResponse.ok(
      "Itinerary retrieved successfully",
      itineraryWithDocuments
    ).send(res);
  }
);

export const deleteItinerary = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Not authenticated");
    }

    const { id } = req.params;

    const itinerary = await Itinerary.findOne({
      _id: id,
      userId: req.user._id,
      isDeleted: false,
    });

    if (!itinerary) {
      throw ApiError.notFound("Itinerary not found or access is denied");
    }

    itinerary.isDeleted = true;
    await itinerary.save();

    ApiResponse.ok("Itinerary deleted successfully").send(res);
  }
);

export const shareItinerary = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Not authenticated");
    }

    const { id } = req.params;

    const itinerary = await Itinerary.findOne({
      _id: id,
      userId: req.user._id,
      isDeleted: false,
    });

    if (!itinerary) {
      throw ApiError.notFound("Itinerary not found or access is denied");
    }

    const isDuplicateKeyError = (error: unknown) => {
      const message = String(error);
      return /e1100?0|duplicate key|duplicate/i.test(message);
    };

    if (itinerary.shareToken) {
      itinerary.isPublic = true;
      itinerary.sharedAt = new Date();
      await itinerary.save();
    } else {
      const maxAttempts = 20;
      let saved = false;
      let lastError: unknown = null;

      for (let attempt = 0; attempt < maxAttempts && !saved; attempt += 1) {
        const token = await generateUniqueShareToken(Itinerary);
        const now = new Date();

        try {
          const updated = await Itinerary.findOneAndUpdate(
            {
              _id: itinerary._id,
              userId: req.user._id,
              isDeleted: false,
              shareToken: { $in: [null, undefined] } as any,
            },
            {
              shareToken: token,
              isPublic: true,
              sharedAt: now,
            },
            { new: true }
          ) as any;

          if (updated) {
            itinerary.shareToken = updated.shareToken;
            itinerary.isPublic = updated.isPublic;
            itinerary.sharedAt = updated.sharedAt;
            saved = true;
            break;
          }

          const refreshed = await Itinerary.findOne({
            _id: itinerary._id,
            userId: req.user._id,
            isDeleted: false,
          });

          if (!refreshed) {
            throw ApiError.notFound("Itinerary not found or access is denied");
          }

          if (refreshed.shareToken) {
            itinerary.shareToken = refreshed.shareToken;
            itinerary.isPublic = refreshed.isPublic;
            itinerary.sharedAt = refreshed.sharedAt;
            saved = true;
            break;
          }

          lastError = new Error("Failed to reserve a unique share token");
        } catch (error) {
          lastError = error;
          if (!isDuplicateKeyError(error) || attempt === maxAttempts - 1) {
            throw error;
          }
        }
      }

      if (!saved) {
        throw lastError ?? new Error("Unable to generate a unique share token");
      }
    }

    const shareUrl = `${env.CLIENT_URL}/shared/${itinerary.shareToken}`;

    ApiResponse.ok("Itinerary sharing enabled successfully", {
      shareToken: itinerary.shareToken,
      shareUrl,
      isPublic: itinerary.isPublic,
      sharedAt: itinerary.sharedAt,
    }).send(res);
  }
);

export const revokeItineraryShare = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Not authenticated");
    }

    const { id } = req.params;

    const itinerary = await Itinerary.findOne({
      _id: id,
      userId: req.user._id,
      isDeleted: false,
    });

    if (!itinerary) {
      throw ApiError.notFound("Itinerary not found or access is denied");
    }

    itinerary.isPublic = false;
    itinerary.shareToken = undefined;
    itinerary.sharedAt = null;
    await itinerary.save();

    ApiResponse.ok("Itinerary sharing revoked successfully", {
      isPublic: false,
    }).send(res);
  }
);

export const getSharedItinerary = asyncHandler(
  async (req: Request, res: Response) => {
    const { token } = req.params;

    const itinerary = await Itinerary.findOne({
      shareToken: token,
      isPublic: true,
      isDeleted: false,
    }).populate("userId", "name");

    if (!itinerary) {
      throw ApiError.notFound("Shared itinerary not found or has been revoked");
    }

    const owner = itinerary.userId as { name?: string } | null;

    ApiResponse.ok("Shared itinerary retrieved successfully", {
      itinerary,
      ownerName: owner?.name || "TripCraft Traveler",
    }).send(res);
  }
);
