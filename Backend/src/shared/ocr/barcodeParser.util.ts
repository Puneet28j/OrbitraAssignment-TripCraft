export type BarcodeKeyFields = {
  pnr?: string;
  flightNumber?: string;
  airports?: string[];
  dates?: string[];
  times?: string[];
  gate?: string;
  seat?: string;
  carrier?: string;
};

const KEY_PATTERNS: Array<[RegExp, keyof BarcodeKeyFields]> = [
  [/(?:PNR|Booking Ref|Record Locator|Reservation|Confirmation Code)[:\s]*([A-Z0-9]{4,8})\b/i, "pnr"],
  [/\b([A-Z]{2}\s?\d{1,4})\b/i, "flightNumber"],
  [/\b([A-Z]{3})\s*[\/\-\s]([A-Z]{3})\b/, "airports"],
  [/from[:\s]*([A-Z]{3})\s*to[:\s]*([A-Z]{3})/i, "airports"],
  [/\b(\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4})\b/, "dates"],
  [/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g, "times"],
  [/gate[:\s]*([A-Z0-9]{1,4})\b/i, "gate"],
  [/seat[:\s]*([A-Z0-9]{1,4})\b/i, "seat"],
  [/(?:carrier|airline)[:\s]*([A-Za-z ]{2,50})\b/i, "carrier"],
];

export function parseBarcodePayload(payload: string): BarcodeKeyFields {
  const text = payload.replace(/\s+/g, " ").trim();
  const fields: BarcodeKeyFields = {};

  for (const [pattern, field] of KEY_PATTERNS) {
    if (field === "airports") {
      const match = text.match(pattern);
      if (match && match[1] && match[2]) {
        fields.airports = [match[1].toUpperCase(), match[2].toUpperCase()];
      }
      continue;
    }

    if (field === "dates") {
      const matches = Array.from(text.matchAll(pattern));
      if (matches.length) {
        fields.dates = matches.map((m) => m[1]);
      }
      continue;
    }

    if (field === "times") {
      const matches = Array.from(text.matchAll(pattern));
      if (matches.length) {
        fields.times = matches.map((m) => `${m[1]}:${m[2]}`);
      }
      continue;
    }

    const match = text.match(pattern);
    if (!match) continue;

    const value = match[1]?.trim();
    if (!value) continue;

    if (field === "pnr") {
      fields.pnr = value.toUpperCase();
    } else if (field === "flightNumber") {
      fields.flightNumber = value.replace(/\s+/g, "").toUpperCase();
    } else if (field === "gate") {
      fields.gate = value.toUpperCase();
    } else if (field === "seat") {
      fields.seat = value.toUpperCase();
    } else if (field === "carrier") {
      fields.carrier = value.trim();
    }
  }

  return fields;
}
