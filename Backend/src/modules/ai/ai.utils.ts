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

function activityDedupeKey(
  activity: ItineraryResponse["days"][0]["activities"][0]
) {
  return `${activity.time ?? ""}|${activity.type}|${activity.title}`
    .trim()
    .toLowerCase();
}

function isRedundantHotelStayDay(
  day: ItineraryResponse["days"][0]
): boolean {
  if (!day.activities.length) return false;

  const hotelActs = day.activities.filter((a) => a.type === "hotel");
  if (hotelActs.length === 0) return false;

  const stayLike = (title: string) =>
    /stay at|enjoy your stay|relaxation|leisure|comfort/i.test(title);

  const nonHotel = day.activities.filter((a) => a.type !== "hotel");
  if (nonHotel.length > 0) return false;

  return hotelActs.every((a) => stayLike(a.title));
}

function hotelStaySignature(day: ItineraryResponse["days"][0]): string {
  const hotel = day.activities.find((a) => a.type === "hotel");
  return `${hotel?.bookingRef ?? ""}|${hotel?.title ?? ""}`.toLowerCase();
}

/** Remove consecutive days that only repeat the same generic hotel stay. */
function collapseRedundantHotelDays(
  days: ItineraryResponse["days"]
): ItineraryResponse["days"] {
  const result: ItineraryResponse["days"] = [];
  let lastRedundantSig = "";

  for (const day of days) {
    if (!isRedundantHotelStayDay(day)) {
      lastRedundantSig = "";
      result.push(day);
      continue;
    }

    const sig = hotelStaySignature(day);
    if (sig && sig === lastRedundantSig) {
      continue;
    }

    lastRedundantSig = sig;
    result.push(day);
  }

  return result;
}

function shortenDestination(destination: string): string {
  const cleaned = destination.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 72) return cleaned;

  const segments = cleaned
    .split(/\s*(?:–|—|,|&|\|)\s*|\s+to\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length >= 2) {
    const short = `${segments[0]} → ${segments[1]}`;
    return short.length <= 72 ? short : `${short.slice(0, 71)}…`;
  }

  return `${cleaned.slice(0, 71)}…`;
}

function parseDayDate(date: string | null | undefined): number {
  if (!date) return Number.MAX_SAFE_INTEGER;
  const t = new Date(date).getTime();
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
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
  itinerary.destination = shortenDestination(itinerary.destination);

  let days = [...itinerary.days].sort(
    (a, b) => parseDayDate(a.date) - parseDayDate(b.date)
  );

  days = collapseRedundantHotelDays(days);

  itinerary.days = days.map((day, index) => {
    const seen = new Set<string>();
    const activities = day.activities
      .filter((activity) => {
        const key = activityDedupeKey(activity);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) =>
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
