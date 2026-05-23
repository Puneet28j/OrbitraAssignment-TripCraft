import ApiError from "../../shared/errors/ApiError.js";
import {
  itineraryResponseSchema,
  type ItineraryResponse,
} from "./itinerary.schema.js";

function activitySortKey(time: string | null | undefined): string {
  if (!time) return "99:99";
  const match = time.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return `${match[1].padStart(2, "0")}:${match[2]}`;
  }
  return time.toLowerCase();
}

function activityDedupeKey(activity: ItineraryResponse["days"][0]["activities"][0]) {
  return `${activity.time ?? ""}|${activity.type}|${activity.title}`
    .trim()
    .toLowerCase();
}

export function safeJsonParse(rawText: string): unknown {
  if (!rawText || typeof rawText !== "string") {
    throw ApiError.badRequest("AI returned an empty response");
  }

  let cleaned = rawText.trim();

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    throw ApiError.badRequest("AI response did not contain valid JSON");
  }

  cleaned = cleaned.slice(jsonStart, jsonEnd + 1);

  try {
    return JSON.parse(cleaned);
  } catch {
    throw ApiError.badRequest("Failed to parse AI response as JSON");
  }
}

export function normalizeItinerary(
  itinerary: ItineraryResponse
): ItineraryResponse {
  itinerary.days = itinerary.days
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((day, index) => {
      const seen = new Set<string>();
      const activities = day.activities
        .filter((activity) => {
          const key = activityDedupeKey(activity);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort(
          (a, b) =>
            activitySortKey(a.time).localeCompare(activitySortKey(b.time))
        );

      return {
        ...day,
        dayNumber: index + 1,
        activities,
      };
    });

  return itinerary;
}

export function validateItineraryResponse(data: unknown): ItineraryResponse {
  const result = itineraryResponseSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join(".") || "itinerary",
      message: issue.message,
    }));
    throw ApiError.validation("AI itinerary failed validation", errors);
  }

  return normalizeItinerary(result.data);
}
