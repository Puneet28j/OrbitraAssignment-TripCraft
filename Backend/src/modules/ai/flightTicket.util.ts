import { extractBoardingPassFlight } from "./boardingPass.util.js";
import {
  dedupeRecords,
  extractAllDates,
  extractAllTimes,
  extractCompactDate,
  extractKeyValues,
  isValidPlaceName,
  matchAll,
  pickRecord,
  sanitizePlaceName,
  titleCase,
} from "./travelExtract.shared.js";

const AIRPORT_CITY: Record<string, string> = {
  DEL: "Delhi",
  BOM: "Mumbai",
  BLR: "Bangalore",
  MAA: "Chennai",
  HYD: "Hyderabad",
  CCU: "Kolkata",
  CDG: "Paris",
  PAR: "Paris",
  LHR: "London",
  JFK: "New York",
  LAX: "Los Angeles",
  DXB: "Dubai",
  SIN: "Singapore",
  GIG: "Rio de Janeiro",
  RIO: "Rio de Janeiro",
};

function airportToCity(code: string): string {
  return AIRPORT_CITY[code.toUpperCase()] ?? code;
}

function extractRouteFromAirportCodes(text: string): Array<Record<string, string>> {
  const flights: Array<Record<string, string>> = [];
  const depArr = [
    ...text.matchAll(
      /(?:dep(?:art(?:ure)?)?|from|origin)\s*[:\-]?\s*([A-Z]{3})\b[\s\S]{0,100}?(?:arr(?:ival)?|to|destination)\s*[:\-]?\s*([A-Z]{3})\b/gi
    ),
  ];
  for (const m of depArr) {
    flights.push({
      from: airportToCity(m[1]),
      to: airportToCity(m[2]),
      documentRole: "flight-ticket",
    });
  }
  return flights;
}

function extractFlightSegments(text: string): Array<Record<string, string>> {
  const segments: Array<Record<string, string>> = [];
  const segmentPattern =
    /([A-Z]{2})\s*(\d{2,4})\b[\s\S]{0,200}?(?:dep|depart)[^\d]*(\d{1,2}:\d{2})?/gi;
  let m: RegExpExecArray | null;
  while ((m = segmentPattern.exec(text)) !== null) {
    segments.push({
      flightNumber: `${m[1]} ${m[2]}`.trim(),
      departureTime: m[3] ?? "",
      documentRole: "flight-ticket",
    });
  }
  return segments;
}

function extractGenericFlight(text: string): Record<string, string> | null {
  if (
    !/boarding|flight|airline|departure|gate|e-?ticket|pnr/i.test(text) &&
    !/\bfrom\b[\s\S]{0,200}\bto\b/i.test(text)
  ) {
    return null;
  }

  const dates = extractAllDates(text, 4);
  const times = extractAllTimes(text, 6);

  const fromTo = text.match(
    /(?:from|origin|depart(?:ing)?)\s*[:\-]?\s*([^\n]{2,50})[\s\S]{0,200}?(?:to|destination|arriv(?:ing|al))\s*[:\-]?\s*([^\n]{2,50})/i
  );
  const flightNo = text.match(
    /(?:flight|flt)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z]{1,3}\s*\d{2,4})/i
  );
  const gate = text.match(/gate\s*[:\-#]?\s*(\d{1,3}[A-Z]?)/i);
  const seat = text.match(/seat\s*[:\-#]?\s*(\d{1,3}[A-Z]{1,2})/i);
  const carrier = text.match(
    /(?:carrier|airline|operated\s*by)\s*[:\-]?\s*([^\n]{3,50})/i
  );
  const pnr = matchAll(
    text,
    /(?:pnr|record\s*locator)\s*[:\-#]?\s*([A-Z0-9]{5,8})/gi
  )[0];

  const record: Record<string, string> = {
    ...(fromTo
      ? { from: fromTo[1].trim(), to: fromTo[2].trim() }
      : {}),
    ...(flightNo ? { flightNumber: flightNo[1].replace(/\s+/g, " ").trim() } : {}),
    ...(gate ? { gate: gate[1] } : {}),
    ...(seat ? { seat: seat[1].toUpperCase() } : {}),
    ...(carrier ? { carrier: carrier[1].trim() } : {}),
    ...(times[0] ? { departureTime: times[0] } : {}),
    ...(dates[0] ? { date: dates[0] } : {}),
  ...(pnr ? { pnr } : {}),
    ...extractKeyValues(text, ["Boarding", "Board till", "Boarding Time"]),
    documentRole: "flight-ticket",
  };

  if (!record.from && !record.to && !record.flightNumber && !record.pnr) {
    return null;
  }

  return record;
}

function mergeFlightRecords(
  base: Record<string, string>,
  extra: Record<string, string>
): Record<string, string> {
  const merged = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    if (value && !merged[key]) merged[key] = value;
  }
  return merged;
}

function flightDedupeKey(r: Record<string, string>): string {
  return [
    pickRecord(r, "from"),
    pickRecord(r, "to"),
    pickRecord(r, "date"),
    pickRecord(r, "flightNumber"),
    pickRecord(r, "pnr"),
  ].join("|");
}

/** All flight/boarding records from one document (deduped). */
export function extractAllFlights(text: string): Array<Record<string, string>> {
  const collected: Array<Record<string, string>> = [];

  const boarding = extractBoardingPassFlight(text);
  if (boarding) collected.push(boarding);

  collected.push(...extractRouteFromAirportCodes(text));
  collected.push(...extractFlightSegments(text));

  const generic = extractGenericFlight(text);
  if (generic) collected.push(generic);

  if (collected.length === 0) return [];

  const merged: Array<Record<string, string>> = [];
  for (const record of collected) {
    const key = flightDedupeKey(record);
    const existing = merged.find((m) => flightDedupeKey(m) === key);
    if (existing) {
      const idx = merged.indexOf(existing);
      merged[idx] = mergeFlightRecords(existing, record);
    } else {
      merged.push({ ...record });
    }
  }

  for (const flight of merged) {
    if (!flight.date) {
      const d = extractCompactDate(text);
      if (d) flight.date = d;
    }
    if (flight.from) {
      const from = sanitizePlaceName(flight.from);
      flight.from = from ? titleCase(from) : "";
    }
    if (flight.to) {
      const to = sanitizePlaceName(flight.to);
      flight.to = to ? titleCase(to) : "";
    }
  }

  const valid = merged.filter(
    (f) =>
      isValidPlaceName(f.from) ||
      isValidPlaceName(f.to) ||
      Boolean(f.flightNumber?.trim()) ||
      Boolean(f.pnr?.trim())
  );

  return dedupeRecords(valid, flightDedupeKey);
}
