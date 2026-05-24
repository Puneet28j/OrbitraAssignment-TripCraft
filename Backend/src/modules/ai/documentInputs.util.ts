import Document from "../../models/Document.js";
import type { IDocumentDocument } from "../../models/Document.js";
import ApiError from "../../shared/errors/ApiError.js";
import logger from "../../shared/logger.js";
import {
  extractTravelFacts,
  shouldRefreshCachedFacts,
  type TravelFacts,
} from "./travelFacts.util.js";
import { isValidPlaceName } from "./travelExtract.shared.js";

export interface DocumentForAI {
  id: string;
  originalName: string;
  fileType: "pdf" | "image";
  /** Full OCR text. */
  text: string;
  /** Compact facts sent to the AI. */
  promptText: string;
  /** Parsed booking facts. */
  facts: TravelFacts;
}

const MAX_PROMPT_CHARS_SINGLE = 4500;
const MAX_PROMPT_CHARS_MULTI = 5500;

/** Lines rich in places, bookings, and logistics — keeps prompts small but detailed. */
export function extractDocContextSnippet(
  rawText: string,
  maxChars: number
): string {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  const priority = lines.filter((l) =>
    /hotel|resort|flight|gate|seat|board|check[\s-]?in|check[\s-]?out|airport|terminal|confirmation|voucher|pnr|booking|passenger|guest|from\b|to\b|depart|arriv|city|address|station|train|bus|rental|room|meal/i.test(
      l
    )
  );

  const source = priority.length > 0 ? priority : lines.slice(0, 20);
  return source
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
}

function buildDocumentHint(facts: TravelFacts): string | undefined {
  const parts: string[] = [];

  if (facts.hotels.length > 1) {
    parts.push(
      `This file has ${facts.hotels.length} hotel vouchers — include ALL with correct check-in/out and cities.`
    );
  }
  if (facts.flights.length > 0) {
    parts.push(
      "Flight/boarding document — dedicated travel day(s) with airport cities, gate, seat, PNR when present."
    );
  }
  if (facts.trains.length > 0) {
    parts.push("Train ticket — include stations, date, train number, class.");
  }
  if (facts.transports.length > 0) {
    parts.push("Ground transport — pickup, drop-off, operator, times.");
  }
  if (facts.documentKind === "mixed") {
    parts.push("Mixed PDF — every booking type in this file must appear in the itinerary.");
  }

  return parts.length ? parts.join(" ") : undefined;
}

/**
 * Rich per-document JSON for the AI: full structured facts + location context from OCR.
 */
function buildDocumentPromptText(
  originalName: string,
  fileType: "pdf" | "image",
  facts: TravelFacts,
  rawText: string,
  multiDocument: boolean
): string {
  const bookingCount =
    facts.hotels.length +
    facts.flights.length +
    facts.trains.length +
    facts.transports.length;

  const contextChars = multiDocument ? 700 : bookingCount > 0 ? 500 : 1200;

  const payload: Record<string, unknown> = {
    file: originalName,
    fileType,
    documentKind: facts.documentKind,
    important: buildDocumentHint(facts),
    passengerNames: facts.passengerNames,
    locations: facts.locations.filter((l) => isValidPlaceName(l)).slice(0, 16),
    flights: facts.flights,
    hotels: facts.hotels,
    trains: facts.trains.length ? facts.trains : undefined,
    transports: facts.transports.length ? facts.transports : undefined,
    dates: facts.dates.slice(0, 12),
    times: facts.times.slice(0, 10),
    bookingRefs: facts.bookingRefs.slice(0, 10),
    meals: facts.meals.length ? facts.meals : undefined,
    notes: facts.notes.slice(0, 8),
    documentContext: extractDocContextSnippet(rawText, contextChars),
  };

  if (bookingCount === 0) {
    payload.rawExcerpt = rawText
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1500);
  }

  const maxChars = multiDocument ? MAX_PROMPT_CHARS_MULTI : MAX_PROMPT_CHARS_SINGLE;
  let compiled = JSON.stringify(payload, null, 2);

  if (compiled.length > maxChars) {
    delete payload.rawExcerpt;
    payload.documentContext = extractDocContextSnippet(rawText, Math.floor(contextChars * 0.6));
    compiled = JSON.stringify(payload, null, 2);
  }

  if (compiled.length > maxChars) {
    payload.notes = facts.notes.slice(0, 3);
    compiled = JSON.stringify(payload, null, 2);
  }

  return compiled;
}

function getCachedFacts(doc: IDocumentDocument): TravelFacts | null {
  const meta = doc.extractionMeta as
    | { structuredFacts?: TravelFacts | null }
    | undefined;
  return meta?.structuredFacts ?? null;
}

/**
 * Load documents from DB and prepare AI prompts using cached structured facts.
 */
export function prepareDocumentsForAI(
  documentIds: string[],
  documents: IDocumentDocument[]
): DocumentForAI[] {
  const byId = new Map(
    documents.map((doc) => [String(doc._id), doc] as const)
  );

  const multiDocument = documentIds.length > 1;
  const ordered: DocumentForAI[] = [];
  const missingText: string[] = [];

  for (const id of documentIds) {
    const doc = byId.get(id);
    if (!doc) continue;

    const text = doc.extractedText?.trim() ?? "";
    if (!text) {
      missingText.push(doc.originalName);
      continue;
    }

    const cached = getCachedFacts(doc);
    const needsRefresh =
      !cached || shouldRefreshCachedFacts(text, cached);
    const facts = needsRefresh ? extractTravelFacts(text) : cached!;

    if (needsRefresh) {
      void Document.findByIdAndUpdate(doc._id, {
        "extractionMeta.structuredFacts": facts,
        "extractionMeta.voucherCount": facts.voucherCount ?? facts.hotels.length,
      }).catch((err) => {
        logger.warn(
          { documentId: doc._id, err },
          "Failed to refresh structured facts"
        );
      });
    }

    ordered.push({
      id: String(doc._id),
      originalName: doc.originalName,
      fileType: doc.fileType,
      text,
      facts,
      promptText: buildDocumentPromptText(
        doc.originalName,
        doc.fileType,
        facts,
        text,
        multiDocument
      ),
    });
  }

  if (missingText.length > 0) {
    throw ApiError.badRequest(
      `No extracted text for: ${missingText.join(", ")}. Wait for extraction to finish or re-upload.`
    );
  }

  if (ordered.length !== documentIds.length) {
    throw ApiError.badRequest(
      "Could not load all selected documents for itinerary generation."
    );
  }

  return ordered;
}
