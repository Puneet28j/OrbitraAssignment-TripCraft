import { z } from "zod";

export const generateItinerarySchema = z.object({
  documentIds: z
    .array(
      z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid document ID format")
    )
    .min(1, "At least one document ID is required")
    .max(20, "Maximum 20 documents per itinerary"),
});

export const listItineraryQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  sort: z.enum(["newest", "oldest"]).optional().default("newest"),
});
