import ApiError from "../../shared/errors/ApiError.js";
import {
  withAIResilience,
  callOpenRouter,
  mapAIError,
  type ChatMessage,
} from "../../shared/openrouter/openrouter.util.js";
import { safeJsonParse, validateItineraryResponse } from "./ai.utils.js";
import type { ItineraryResponse } from "./itinerary.schema.js";
import type { DocumentForAI } from "./documentInputs.util.js";
import logger from "../../shared/logger.js";

/** Per-document cap to keep multi-doc prompts within model context. */
const MAX_CHARS_PER_DOCUMENT = 12_000;
const ITINERARY_MAX_TOKENS = 8192;

const SYSTEM_PROMPT = `You are TripCraft AI, an expert travel planner and storyteller. You turn raw travel documents into rich, premium, day-by-day itineraries that feel personal, vivid, and practical — like a concierge wrote them.

Your output must be ONLY a raw JSON object matching the target schema.
DO NOT wrap the response in markdown blocks (e.g. no \`\`\`json ... \`\`\`), no preamble, no explanations, no text before or after the JSON object.

DOCUMENT FACTS (CRITICAL — never violate):
1. Every flight, hotel, train, and confirmed booking from the documents MUST appear as activities with correct times, locations, and bookingRef when provided.
2. Never invent confirmation numbers, voucher codes, prices, seat numbers, gates, or dates that are not in the documents.
3. If a detail is missing in the documents, use null — do not guess.

MULTI-DOCUMENT (CRITICAL):
1. Merge ALL documents into ONE chronological trip. Include every booking from every document.
2. If documents span different cities or dates (e.g. flight to Rio + hotel in Jaipur), structure days to cover the full journey in order.

RICHNESS & DETAIL (CRITICAL — this is what makes TripCraft special):
1. Aim for 5–8 activities per active travel day (days with flights, check-ins, or major moves). Quieter days: at least 3–4 activities.
2. Write evocative day titles (e.g. "Wheels Up: Paris to Rio", "Arrival & Amber City Check-in").
3. Each activity needs:
   - title: short, specific headline (not generic)
   - description: 2–4 sentences — practical tips, atmosphere, what to expect, local context. Be creative and warm but factual.
   - time: use document times when available; otherwise infer sensible times (e.g. arrive airport 2h before flight, check-in at hotel check-in time from voucher)
   - location: city, airport, hotel name, or neighborhood when known
   - duration: when relevant (e.g. "3h 30m" for flight, "1 night" for hotel stay)
4. Expand around documented events with logical, place-aware activities:
   - Flight day: pre-departure (packing, leave for airport), airport check-in/security, boarding, in-flight, arrival, immigration/baggage, transfer to hotel or next leg
   - Hotel check-in day: arrival transfer, check-in, room settle, included meals (breakfast/dinner from voucher), evening rest or light local stroll
   - Between documented bookings: suggest 1–2 iconic sightseeing or dining options for THAT city (well-known landmarks/areas only — no fake tickets; bookingRef must be null for suggestions)
5. Use destination knowledge: for Jaipur suggest Amber Fort, Hawa Mahal, local Rajasthani cuisine; for Rio suggest Copacabana, Christ the Redeemer area — as optional exploration, not booked tours.
6. summary: 2–3 polished sentences capturing the trip arc and highlights.
7. Match tone to the trip: business-like for tight connections; relaxed for resort stays.

LOGICAL RULES:
1. Activities within each day in strict chronological order.
2. Activity type must be one of: flight, hotel, transport, sightseeing, dining, activity, other.
3. Times in 24h format when possible ("08:10", "14:00").
4. Parse all dates from documents; assign each activity to the correct day.

TARGET SCHEMA:
{
  "title": "String (catchy trip title)",
  "destination": "String (primary destination or multi-city label)",
  "startDate": "YYYY-MM-DD or null",
  "endDate": "YYYY-MM-DD or null",
  "summary": "String (2–3 sentence premium overview)",
  "days": [
    {
      "dayNumber": Number,
      "date": "YYYY-MM-DD or null",
      "title": "String (evocative theme for the day)",
      "activities": [
        {
          "time": "String or null",
          "type": "flight | hotel | transport | sightseeing | dining | activity | other",
          "title": "String",
          "description": "String (2–4 detailed sentences)",
          "location": "String or null",
          "bookingRef": "String or null (only from documents)",
          "duration": "String or null"
        }
      ]
    }
  ]
}`;

const RETRY_PROMPT_SUFFIX = `

RETRY: Your previous response failed validation. Return ONLY valid JSON matching the schema. Include all document bookings plus rich contextual activities. Do not invent booking references.`;

function truncateDocumentText(text: string, label: string): string {
  if (text.length <= MAX_CHARS_PER_DOCUMENT) return text;
  logger.warn(
    { label, originalLength: text.length, max: MAX_CHARS_PER_DOCUMENT },
    "Truncating document text for AI prompt"
  );
  return `${text.slice(0, MAX_CHARS_PER_DOCUMENT)}\n\n[Text truncated for length…]`;
}

function buildDocumentPromptSection(documents: DocumentForAI[]): string {
  const count = documents.length;
  return documents
    .map((doc, i) => {
      const body = truncateDocumentText(doc.text, doc.originalName);
      return `--- DOCUMENT ${i + 1} of ${count}: "${doc.originalName}" (${doc.fileType.toUpperCase()}) ---\n${body}`;
    })
    .join("\n\n");
}

async function callAI(
  documents: DocumentForAI[],
  isRetry: boolean
): Promise<string> {
  const userPrompt = `Create ONE detailed, creative, unified itinerary from ALL ${documents.length} documents below.

Requirements:
- Include EVERY flight, hotel, and booking from every document (correct times, refs, locations).
- Build 5–8 activities on major travel days; fill gaps with logical transport, meals, and destination-appropriate suggestions.
- Write rich 2–4 sentence descriptions for each activity.
- Use evocative day titles and a polished summary.

${buildDocumentPromptSection(documents)}

Return only valid JSON matching the schema.${
    isRetry ? RETRY_PROMPT_SUFFIX : ""
  }`;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  return withAIResilience(
    async (modelName) =>
      callOpenRouter(modelName, messages, {
        maxTokens: ITINERARY_MAX_TOKENS,
        temperature: 0.55,
      }),
    { label: "itinerary-generation" }
  );
}

export async function generateItinerary(
  documents: DocumentForAI[]
): Promise<ItineraryResponse> {
  if (!documents || documents.length === 0) {
    throw ApiError.badRequest(
      "No document text provided for AI itinerary generation"
    );
  }

  logger.info(
    {
      documentCount: documents.length,
      names: documents.map((d) => d.originalName),
    },
    "Generating itinerary from documents"
  );

  const attempts = [false, true];

  for (let i = 0; i < attempts.length; i += 1) {
    const isRetry = attempts[i];
    try {
      const responseText = await callAI(documents, isRetry);
      const parsedOutput = safeJsonParse(responseText);
      return validateItineraryResponse(parsedOutput);
    } catch (error) {
      const isValidationError =
        error instanceof ApiError && error.statusCode === 422;
      const hasAnotherAttempt = i < attempts.length - 1;

      if (isValidationError && hasAnotherAttempt) {
        logger.warn("AI itinerary validation failed, retrying once");
        continue;
      }

      if (error instanceof ApiError) {
        throw error;
      }

      throw mapAIError(error);
    }
  }

  throw ApiError.internal("AI Generation failed after retry");
}
