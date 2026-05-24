import { classifyTravelDocument } from "./documentClassifier.util.js";
import { extractAllFlights } from "./flightTicket.util.js";
import { countVoucherMarkers, extractAllHotels } from "./hotelVoucher.util.js";
import { extractAllTrains } from "./trainTicket.util.js";
import { extractAllTransports } from "./transportTicket.util.js";
import {
  extractAllDates,
  extractAllTimes,
  extractBookingRefs,
  extractPassengerNames,
  sanitizePlaceName,
  unique,
  dedupeRecords,
} from "./travelExtract.shared.js";
import { parseBarcodePayload } from "../../shared/ocr/barcodeParser.util.js";
import type { TravelDocumentKind, TravelFacts } from "./travelFacts.types.js";

export type { TravelDocumentKind, TravelFacts } from "./travelFacts.types.js";

export function shouldRefreshCachedFacts(
  text: string,
  cached: TravelFacts | null | undefined
): boolean {
  if (!cached) return true;

  const normalized = text.replace(/\r\n/g, "\n").trim();
  const markers = countVoucherMarkers(normalized);
  if (markers > 1 && cached.hotels.length < markers) return true;
  if (markers > 1 && (cached.voucherCount ?? 0) !== markers) return true;

  if (extractAllHotels(normalized).length > cached.hotels.length) return true;
  if (extractAllFlights(normalized).length > cached.flights.length) return true;
  if (extractAllTrains(normalized).length > cached.trains.length) return true;
  if (extractAllTransports(normalized).length > cached.transports.length)
    return true;

  return false;
}

function splitDocumentSections(text: string): string[] {
  const markers =
    /\b(boarding pass|boardingpass|flight ticket|hotel voucher|train ticket|bus ticket|car rental|reservation|itinerary|confirmation|voucher)\b/i;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sections: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (markers.test(line) && current.length > 0) {
      sections.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  }

  if (current.length) sections.push(current.join("\n"));
  return sections.filter((section) => section.trim().length > 20);
}

function extractTravelFactsFromSection(
  text: string,
  preclassified?: ReturnType<typeof classifyTravelDocument>
): TravelFacts {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const hotels = extractAllHotels(normalized);
  const flights = extractAllFlights(normalized);
  const trains = extractAllTrains(normalized);
  const transports = extractAllTransports(normalized);
  const dates = extractAllDates(normalized, 16);
  const times = extractAllTimes(normalized, 12);
  const bookingRefs = unique(
    [
      ...extractBookingRefs(normalized),
      ...hotels
        .map((h) => h.hotelConfirmation || h.voucherNumber || "")
        .filter(Boolean),
      ...flights.map((f) => f.pnr || "").filter(Boolean),
      ...trains.map((t) => t.pnr || "").filter(Boolean),
    ],
    12
  );
  const passengerNames = unique(
    [
      ...extractPassengerNames(normalized),
      ...hotels.map((h) => h.guestName).filter(Boolean),
      ...flights.map((f) => f.passengerName).filter(Boolean),
    ],
    8
  );
  const locations = unique(
    [
      ...hotels.map((h) => sanitizePlaceName(h.city)).filter(Boolean),
      ...flights.flatMap((f) =>
        [sanitizePlaceName(f.from), sanitizePlaceName(f.to)].filter(Boolean)
      ),
      ...trains.flatMap((t) =>
        [sanitizePlaceName(t.from), sanitizePlaceName(t.to)].filter(Boolean)
      ),
      ...transports.flatMap((t) =>
        [
          sanitizePlaceName(t.from),
          sanitizePlaceName(t.to),
          sanitizePlaceName(t.pickup),
          sanitizePlaceName(t.dropoff),
        ].filter(Boolean)
      ),
    ],
    16
  );
  const meals = unique(hotels.map((h) => h.meals).filter(Boolean), 8);
  const notes: string[] = [];
  for (const hotel of hotels) {
    const summary = [hotel.hotel, hotel.city, hotel.checkIn, hotel.checkOut]
      .filter(Boolean)
      .join(" | ");
    if (summary) notes.push(summary);
  }
  for (const flight of flights) {
    const summary = [flight.from, flight.to, flight.date, flight.flightNumber]
      .filter(Boolean)
      .join(" | ");
    if (summary) notes.push(`Flight: ${summary}`);
  }
  for (const train of trains) {
    const summary = [train.from, train.to, train.date, train.trainNumber]
      .filter(Boolean)
      .join(" | ");
    if (summary) notes.push(`Train: ${summary}`);
  }
  const classification =
    preclassified ?? classifyTravelDocument(normalized);
  const documentType = resolveLegacyDocumentType(
    hotels,
    flights,
    trains,
    transports,
    classification.primary
  );

  return {
    documentType,
    documentKind: classification.primary,
    detectedKinds: classification.detected,
    classificationConfidence: classification.confidence,
    passengerNames,
    flights,
    hotels,
    trains,
    transports,
    dates,
    times,
    locations,
    bookingRefs,
    meals,
    notes: unique(notes, 16),
    voucherCount:
      countVoucherMarkers(normalized) > 0
        ? countVoucherMarkers(normalized)
        : hotels.length,
  };
}

export function extractTravelFacts(text: string): TravelFacts {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const classification = classifyTravelDocument(normalized);
  const voucherCount = countVoucherMarkers(normalized);
  const hotelsFromVouchers = extractAllHotels(normalized);

  const sections = splitDocumentSections(normalized);
  const useSectionMerge =
    (classification.primary === "mixed" && sections.length > 1) ||
    (hotelsFromVouchers.length > 1 && sections.length > 1);

  if (useSectionMerge) {
    const sectionFacts = sections.map((section) =>
      extractTravelFactsFromSection(section)
    );
    const mergedFlights = dedupeRecords(
      sectionFacts.flatMap((s) => s.flights as Array<Record<string, string>>),
      (record) =>
        [
          record.from,
          record.to,
          record.flightNumber,
          record.date,
          record.pnr,
        ].join("|")
    );
    const mergedHotels = dedupeRecords(
      sectionFacts.flatMap((s) => s.hotels as Array<Record<string, string>>),
      (record) =>
        [
          record.hotel,
          record.city,
          record.checkIn,
          record.checkOut,
          record.hotelConfirmation,
          record.voucherNumber,
          record.voucherIndex,
        ].join("|")
    );
    const mergedTrains = dedupeRecords(
      sectionFacts.flatMap((s) => s.trains as Array<Record<string, string>>),
      (record) =>
        [
          record.from,
          record.to,
          record.trainNumber,
          record.date,
          record.pnr,
        ].join("|")
    );
    const mergedTransports = dedupeRecords(
      sectionFacts.flatMap(
        (s) => s.transports as Array<Record<string, string>>
      ),
      (record) => [record.type, record.from, record.to, record.date].join("|")
    );

    return {
      documentType: "multi",
      documentKind: "mixed",
      detectedKinds: unique(
        sectionFacts.flatMap((s) => s.detectedKinds),
        16
      ) as TravelDocumentKind[],
      classificationConfidence: Math.min(
        100,
        Math.max(
          ...sectionFacts.map(
            (section) => section.classificationConfidence ?? 0
          )
        )
      ),
      passengerNames: unique(
        sectionFacts.flatMap((s) => s.passengerNames),
        12
      ),
      flights: mergedFlights as TravelFacts["flights"],
      hotels: mergedHotels as TravelFacts["hotels"],
      trains: mergedTrains as TravelFacts["trains"],
      transports: mergedTransports as TravelFacts["transports"],
      dates: unique(
        sectionFacts.flatMap((s) => s.dates),
        32
      ),
      times: unique(
        sectionFacts.flatMap((s) => s.times),
        32
      ),
      locations: unique(
        sectionFacts.flatMap((s) => s.locations),
        32
      ),
      bookingRefs: unique(
        sectionFacts.flatMap((s) => s.bookingRefs),
        32
      ),
      meals: unique(
        sectionFacts.flatMap((s) => s.meals),
        32
      ),
      notes: unique(
        sectionFacts.flatMap((s) => s.notes),
        32
      ),
      voucherCount: Math.max(
        voucherCount,
        hotelsFromVouchers.length,
        sectionFacts.reduce((sum, s) => sum + (s.voucherCount ?? 0), 0)
      ),
    };
  }

  const sectionFacts = extractTravelFactsFromSection(
    normalized,
    classification
  );

  if (hotelsFromVouchers.length > sectionFacts.hotels.length) {
    return {
      ...sectionFacts,
      hotels: hotelsFromVouchers,
      documentType: hotelsFromVouchers.length > 1 ? "multi" : sectionFacts.documentType,
      documentKind:
        hotelsFromVouchers.length > 1 && sectionFacts.flights.length > 0
          ? "mixed"
          : sectionFacts.documentKind,
      voucherCount: Math.max(voucherCount, hotelsFromVouchers.length),
    };
  }

  return sectionFacts;
}

/** Enrich flight facts from barcode payloads (boarding passes). */
export function mergeBarcodeIntoFacts(
  facts: TravelFacts,
  barcodePayloads: string[]
): TravelFacts {
  if (!barcodePayloads.length) return facts;

  const merged = { ...facts, flights: [...facts.flights] };
  const existingKeys = new Set(
    merged.flights.map((f) =>
      [f.from, f.to, f.flightNumber, f.pnr].join("|").toLowerCase()
    )
  );

  for (const payload of barcodePayloads) {
    const raw = payload.trim();
    if (!raw) continue;

    const parsed = parseBarcodePayload(raw);
    const from = parsed.airports?.[0] ?? "";
    const to = parsed.airports?.[1] ?? "";
    const flightNumber = (parsed.flightNumber ?? "").replace(/\s/g, "");
    const pnr = parsed.pnr ?? "";

    const key = [from, to, flightNumber, pnr].join("|").toLowerCase();
    if (existingKeys.has(key) && key.replace(/\|/g, "").length > 0) continue;

    if (!from && !to && !flightNumber && !pnr) continue;

    merged.flights.push({
      from,
      to,
      flightNumber,
      pnr,
      date: parsed.dates?.[0] ?? "",
      departureTime: parsed.times?.[0] ?? "",
      gate: parsed.gate ?? "",
      seat: parsed.seat ?? "",
      carrier: parsed.carrier ?? "",
      passengerName: merged.passengerNames[0] ?? "",
    });
    existingKeys.add(key);

    if (pnr && !merged.bookingRefs.includes(pnr)) {
      merged.bookingRefs = unique([...merged.bookingRefs, pnr], 12);
    }
  }

  if (merged.flights.length > facts.flights.length) {
    if (merged.documentKind === "hotel_voucher") {
      merged.documentKind = "mixed";
    } else if (merged.documentKind === "travel_other") {
      merged.documentKind = "boarding_pass";
    }
  }

  return merged;
}

function resolveLegacyDocumentType(
  hotels: TravelFacts["hotels"],
  flights: TravelFacts["flights"],
  trains: TravelFacts["trains"],
  transports: TravelFacts["transports"],
  kind: TravelDocumentKind
): TravelFacts["documentType"] {
  const typeCount = [hotels, flights, trains, transports].filter(
    (a) => a.length > 0
  ).length;

  if (typeCount > 1 || kind === "mixed") return "multi";
  if (flights.length) return "flight";
  if (hotels.length) return "hotel";
  if (trains.length) return "train";
  return "other";
}
