import ApiError from "../../shared/errors/ApiError.js";
import {
  withAIResilience,
  callOpenRouter,
  mapAIError,
  type ChatMessage,
} from "../../shared/openrouter/openrouter.util.js";
import { safeJsonParse, validateItineraryResponse } from "./ai.utils.js";
import type { ItineraryResponse } from "./itinerary.schema.js";
import logger from "../../shared/logger.js";

const SYSTEM_PROMPT = `You are TripCraft AI, an expert travel planner. You build highly-detailed, logical travel itineraries from raw travel document texts (like flight confirmations, hotel bookings, bus tickets, tours, and receipts).

Your output must be ONLY a raw JSON object matching the target schema.
DO NOT wrap the response in markdown blocks (e.g. no \`\`\`json ... \`\`\`), no preamble, no explanations, no text before or after the JSON object.

ANTI-HALLUCINATION RULES (CRITICAL):
1. Only include flights, hotels, bookings, dates, locations, and references that appear in the provided document texts.
2. If information is missing or unclear, use null for optional fields rather than inventing details.
3. Do not add sightseeing, dining, or transport activities unless supported by the documents or logically required between documented events (e.g. airport to hotel after a listed flight arrival).
4. Never fabricate confirmation numbers, prices, or booking references.

CRITICAL LOGICAL RULES:
1. Chronological Ordering: Activities within each day must be in chronological order.
2. Gap Inference: You may infer minimal logical intermediate steps only when clearly implied between documented events.
3. Activity Type: Each activity must have a valid 'type' field from: ['flight', 'hotel', 'transport', 'sightseeing', 'dining', 'activity', 'other'].
4. Time formats: Use logical time formats (e.g., "14:30" or "09:00").
5. Parse dates accurately. If multiple dates exist, structure the days chronologically.

TARGET SCHEMA:
{
  "title": "String (A catchy and beautiful trip title)",
  "destination": "String (Primary destination city/country)",
  "startDate": "YYYY-MM-DD or null",
  "endDate": "YYYY-MM-DD or null",
  "summary": "String (Brief, premium, and exciting overview of the trip)",
  "days": [
    {
      "dayNumber": Number (1-based index),
      "date": "YYYY-MM-DD or null",
      "title": "String (Theme of the day)",
      "activities": [
        {
          "time": "String or null",
          "type": "flight | hotel | transport | sightseeing | dining | activity | other",
          "title": "String",
          "description": "String",
          "location": "String or null",
          "bookingRef": "String or null",
          "duration": "String or null"
        }
      ]
    }
  ]
}`;

const RETRY_PROMPT_SUFFIX = `

RETRY: Your previous response failed validation. Return ONLY valid JSON matching the schema exactly. Use only facts from the documents. Do not invent data.`;

async function callAI(
  documentTexts: string[],
  isRetry: boolean
): Promise<string> {
  const userPrompt = `Generate a single unified travel itinerary combining the following travel document texts:\n\n${documentTexts
    .map((text, i) => `--- DOCUMENT ${i + 1} ---\n${text}`)
    .join(
      "\n\n"
    )}\n\nStrictly adhere to the system prompt guidelines and schema.${
    isRetry ? RETRY_PROMPT_SUFFIX : ""
  }`;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  return withAIResilience(
    async (modelName) => callOpenRouter(modelName, messages),
    { label: "itinerary-generation" }
  );
}

export async function generateItinerary(
  documentTexts: string[]
): Promise<ItineraryResponse> {
  if (!documentTexts || documentTexts.length === 0) {
    throw ApiError.badRequest(
      "No document text provided for AI itinerary generation"
    );
  }

  const attempts = [false, true];

  for (let i = 0; i < attempts.length; i += 1) {
    const isRetry = attempts[i];
    try {
      const responseText = await callAI(documentTexts, isRetry);
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
