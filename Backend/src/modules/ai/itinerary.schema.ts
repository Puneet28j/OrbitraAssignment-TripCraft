import { z } from "zod";

export const ACTIVITY_TYPES = [
  "flight",
  "hotel",
  "transport",
  "sightseeing",
  "dining",
  "activity",
  "other",
] as const;

const activitySchema = z.object({
  time: z.string().nullable().optional().default(null),
  type: z.enum(ACTIVITY_TYPES).default("other"),
  title: z.string().min(1, "Activity title is required"),
  description: z.string().optional().default(""),
  location: z.string().nullable().optional().default(null),
  bookingRef: z.string().nullable().optional().default(null),
  duration: z.string().nullable().optional().default(null),
});

const daySchema = z.object({
  dayNumber: z.number().int().min(1),
  date: z.string().nullable().optional().default(null),
  title: z.string().min(1, "Day title is required"),
  activities: z.array(activitySchema).default([]),
});

export const itineraryResponseSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  destination: z.string().min(1, "Destination is required").max(150),
  startDate: z.string().nullable().optional().default(null),
  endDate: z.string().nullable().optional().default(null),
  summary: z.string().optional().default(""),
  days: z.array(daySchema).min(1, "At least one day is required"),
});

export type ItineraryResponse = z.infer<typeof itineraryResponseSchema>;
