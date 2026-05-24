import {
  dedupeRecords,
  extractAllDates,
  extractCompactDate,
  extractKeyValues,
  isValidPlaceName,
  pickRecord,
  sanitizePlaceName,
} from "./travelExtract.shared.js";

const BUS_KEYS = ["From", "To", "Date", "Time", "Seat", "Bus", "Operator"] as const;
const CAR_KEYS = [
  "Pick-up",
  "Pickup",
  "Drop-off",
  "Dropoff",
  "Vehicle",
  "Rental",
  "Confirmation",
] as const;

function isBusDocument(text: string): boolean {
  if (/\bbus\s*(?:ticket|no\.?|number|from|to|operator)\b/i.test(text)) {
    return true;
  }
  if (/\bcoach\s*ticket\b/i.test(text)) return true;
  if (/\b(redbus|volvo\s*bus|sleeper\s*bus)\b/i.test(text)) return true;
  return false;
}

function extractPlaceAfterLabel(
  text: string,
  label: "from" | "to"
): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const labelRe = label === "from" ? /^(?:from|origin)$/i : /^(?:to|destination)$/i;

  for (let i = 0; i < lines.length; i += 1) {
    if (labelRe.test(lines[i])) {
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j += 1) {
        const candidate = sanitizePlaceName(lines[j]);
        if (candidate) return candidate;
      }
    }
  }

  const inline =
    label === "from"
      ? text.match(/(?:^|\n)\s*from\s*[:\-]\s*([^\n]{2,48})/im)?.[1]
      : text.match(/(?:^|\n)\s*to\s*[:\-]\s*([^\n]{2,48})/im)?.[1];

  return sanitizePlaceName(inline);
}

function extractBusTickets(text: string): Array<Record<string, string>> {
  if (!isBusDocument(text)) return [];

  const kv = extractKeyValues(text, BUS_KEYS);
  const from = sanitizePlaceName(kv.From) || extractPlaceAfterLabel(text, "from");
  const to = sanitizePlaceName(kv.To) || extractPlaceAfterLabel(text, "to");

  if (!isValidPlaceName(from) && !isValidPlaceName(to)) return [];
  if (!from && !to) return [];

  return [
    {
      type: "bus",
      from,
      to,
      operator: kv.Operator ?? kv.Bus ?? "",
      seat: kv.Seat ?? "",
      date: kv.Date ?? extractCompactDate(text) ?? extractAllDates(text, 1)[0] ?? "",
      time: kv.Time ?? "",
      documentRole: "bus-ticket",
    },
  ];
}

function extractCarRentals(text: string): Array<Record<string, string>> {
  if (!/car\s*rental|rental\s*car|hire\s*car|vehicle\s*hire/i.test(text)) {
    return [];
  }

  const kv = extractKeyValues(text, CAR_KEYS);
  const pickup = sanitizePlaceName(kv.Pickup ?? kv["Pick-up"]);
  const dropoff = sanitizePlaceName(kv.Dropoff ?? kv["Drop-off"]);

  if (!pickup && !dropoff && !kv.Confirmation) return [];

  return [
    {
      type: "car_rental",
      pickup,
      dropoff,
      vehicle: kv.Vehicle ?? "",
      confirmation: kv.Confirmation ?? kv.Rental ?? "",
      date: extractCompactDate(text) ?? "",
      documentRole: "car-rental",
    },
  ];
}

/** Bus, car rental, and similar ground transport tickets. */
export function extractAllTransports(
  text: string
): Array<Record<string, string>> {
  const records = [...extractBusTickets(text), ...extractCarRentals(text)];
  return dedupeRecords(records, (r) =>
    [
      pickRecord(r, "type"),
      pickRecord(r, "from"),
      pickRecord(r, "to"),
      pickRecord(r, "pickup"),
      pickRecord(r, "date"),
    ].join("|")
  );
}
