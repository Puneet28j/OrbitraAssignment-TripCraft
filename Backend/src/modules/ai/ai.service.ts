import ApiError from "../../shared/errors/ApiError.js";
import env from "../../config/env.js";
import {
  withAIResilience,
  callOpenRouter,
  mapAIError,
  type ChatMessage,
} from "../../shared/openrouter/openrouter.util.js";
import { safeJsonParse, validateItineraryResponse } from "./ai.utils.js";
import { enrichItineraryFromFacts } from "./itineraryEnrichment.util.js";
import { ensureAllBookingsCovered } from "./itineraryCoverage.util.js";
import {
  buildMasterBookingInventory,
  formatMasterInventoryForPrompt,
  type MasterBookingInventory,
} from "./mergedFacts.util.js";
import type { ItineraryResponse } from "./itinerary.schema.js";
import type { DocumentForAI } from "./documentInputs.util.js";
import logger from "../../shared/logger.js";

const SYSTEM_PROMPT = `You are TripCraft AI. Merge ALL uploaded documents into ONE chronological itinerary. Output ONLY raw JSON.

MULTI-DOCUMENT (CRITICAL):
- You receive a MASTER BOOKING INVENTORY plus one block per uploaded file.
- Every checklist item (H1, F1, T1, B1…) from EVERY file must appear — never drop a leg because another doc has hotels.
- One PDF with 4 hotel vouchers = H1, H2, H3, H4 (each with its own city, dates, check-in/out) — never collapse into a single hotel stay.
- Different files may be different regions (e.g. Paris flight + Rajasthan hotels) — include ALL places in order.

TITLE & DESTINATION:
- title: memorable trip name mentioning key regions (e.g. "Paris to Rio & Rajasthan Heritage").
- destination: full route label listing major places in travel order, joined with " → " (up to 120 chars). Example: "Paris → Rio de Janeiro → Jaipur → Jodhpur".
- summary: 2–3 sentences naming every major city/hotel/flight from the inventory.

DAY HEADERS:
- Each day title must name the city or route (e.g. "Flight Paris to Rio", "Check-in — Jaipur Heritage Hotel", "Train Delhi to Agra").

ACTIVITIES (DETAILED):
- Booking days (flight, hotel check-in/out): 5–7 timed activities each with specific titles.
- Transfer days: 4–6 activities.
- EVERY activity needs:
  - title: specific (hotel name, flight number, station names — not "Stay" or "Activity").
  - description: 1–2 sentences using facts from docs (guest name, confirmation/PNR, gate, seat, room type, meals, times).
  - location: city, airport, hotel name, or station from the documents (never null when known in inventory).
  - bookingRef: confirmation, PNR, or voucher when available.
- NEVER use room amenity text (toiletries, kettle, Wi-Fi, "Room Facilities") as a city, location, or day title.

DATES:
- Use check-in/check-out and flight dates from inventory; do not invent dates.
- Align hotel and flight days correctly across documents.

SCHEMA:
{"title":"string","destination":"string","startDate":"YYYY-MM-DD|null","endDate":"YYYY-MM-DD|null","summary":"string","days":[{"dayNumber":number,"date":"YYYY-MM-DD|null","title":"string","activities":[{"time":"string|null","type":"flight|hotel|transport|sightseeing|dining|activity|other","title":"string","description":"string","location":"string|null","bookingRef":"string|null","duration":"string|null"}]}]}`;

const RETRY_PROMPT_SUFFIX =
  "\n\nRETRY: Include EVERY checklist item from ALL documents. Each activity must have location + detailed description from facts. Valid JSON only.";

function buildDocumentPromptSection(documents: DocumentForAI[]): string {
  return documents
    .map((doc, i) => {
      return `=== DOCUMENT ${i + 1}/${documents.length}: "${doc.originalName}" (${doc.fileType}) ===\n${doc.promptText}`;
    })
    .join("\n\n");
}

function hasStructuredBookings(inventory: MasterBookingInventory): boolean {
  return (
    inventory.hotelCount +
      inventory.flightCount +
      inventory.trainCount +
      inventory.transportCount >
    0
  );
}

/** Scale output budget for multi-doc / multi-booking trips without always using max cap. */
function resolveOutputTokenBudget(
  documents: DocumentForAI[],
  inventory: MasterBookingInventory
): number {
  const bookingTotal =
    inventory.hotelCount +
    inventory.flightCount +
    inventory.trainCount +
    inventory.transportCount;
  const scaled =
    env.OPENROUTER_MAX_OUTPUT_TOKENS +
    documents.length * 550 +
    bookingTotal * 100;
  return Math.min(Math.max(scaled, env.OPENROUTER_MAX_OUTPUT_TOKENS), 6500);
}

async function callAI(
  documents: DocumentForAI[],
  inventory: MasterBookingInventory,
  inventoryPrompt: string,
  retryMode: "none" | "retry",
  maxTokens: number
): Promise<string> {
  logger.info(
    {
      documentCount: documents.length,
      hotels: inventory.hotelCount,
      flights: inventory.flightCount,
      trains: inventory.trainCount,
      transports: inventory.transportCount,
      maxTokens,
      promptChars:
        inventoryPrompt.length +
        documents.reduce((n, d) => n + d.promptText.length, 0),
    },
    "Itinerary AI prompt"
  );

  const retrySuffix =
    retryMode === "retry" ? RETRY_PROMPT_SUFFIX : "";

  const multiNote =
    documents.length > 1
      ? `\nYou have ${documents.length} separate files — merge every booking from every file into one timeline. Use destination "CityA → CityB → …" listing all regions.\n`
      : "";

  const userPrompt = `Build ONE unified itinerary from ${documents.length} separate uploaded file(s).${multiNote}

${inventoryPrompt}

${buildDocumentPromptSection(documents)}

Before finishing, verify every checklist item (H1, H2, … F1, …) appears with correct dates, locations, and booking references.

Return JSON only.${retrySuffix}`;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  return withAIResilience(
    async (modelName) =>
      callOpenRouter(modelName, messages, {
        maxTokens,
        temperature: 0.34,
      }),
    {
      label: "itinerary-generation",
      maxModels: env.OPENROUTER_MAX_MODELS,
      maxRetriesPerModel: 1,
    }
  );
}

export async function generateItinerary(
  documents: DocumentForAI[]
): Promise<ItineraryResponse> {
  if (!documents?.length) {
    throw ApiError.badRequest(
      "No document text provided for AI itinerary generation"
    );
  }

  const inventory = buildMasterBookingInventory(documents);
  const inventoryPrompt = formatMasterInventoryForPrompt(inventory);
  const hasBookings = hasStructuredBookings(inventory);
  const maxTokens = resolveOutputTokenBudget(documents, inventory);

  if (!hasBookings) {
    logger.warn(
      { documentCount: documents.length },
      "No structured bookings extracted; relying on raw OCR"
    );
  }

  const attempts: Array<"none" | "retry"> = hasBookings
    ? ["none", "retry"]
    : ["none"];

  for (let i = 0; i < attempts.length; i += 1) {
    const retryMode = attempts[i];
    try {
      const responseText = await callAI(
        documents,
        inventory,
        inventoryPrompt,
        retryMode,
        maxTokens
      );
      const parsedOutput = safeJsonParse(responseText);
      const validated = validateItineraryResponse(parsedOutput);
      const covered = ensureAllBookingsCovered(validated, inventory);
      const enriched = enrichItineraryFromFacts(covered, documents, inventory);

      logger.info(
        {
          documentCount: documents.length,
          hotels: inventory.hotelCount,
          flights: inventory.flightCount,
          trains: inventory.trainCount,
          transports: inventory.transportCount,
          maxTokens,
          days: enriched.days.length,
          totalActivities: enriched.days.reduce(
            (n, d) => n + d.activities.length,
            0
          ),
        },
        "Itinerary generated"
      );

      return enriched;
    } catch (error) {
      const isValidationError =
        error instanceof ApiError && error.statusCode === 422;
      const hasAnotherAttempt = i < attempts.length - 1;

      if (isValidationError && hasAnotherAttempt && hasBookings) {
        logger.warn(
          { retryMode },
          "AI itinerary validation failed, retrying with a stricter prompt"
        );
        continue;
      }

      if (error instanceof ApiError) throw error;
      throw mapAIError(error);
    }
  }

  throw ApiError.internal("AI Generation failed after retry");
}
