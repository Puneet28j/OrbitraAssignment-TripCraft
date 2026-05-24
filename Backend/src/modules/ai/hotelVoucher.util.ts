import {
  dedupeRecords,
  extractKeyValues,
  mergeTinySections,
  pickRecord,
  sanitizePlaceName,
} from "./travelExtract.shared.js";

const HOTEL_KEYS = [
  "Hotel",
  "Property",
  "City",
  "Guest Name",
  "Voucher Number",
  "Checkin",
  "Check out",
  "Check-in",
  "Check-out",
  "Type of Room",
  "Meal includes",
  "Hotel Confirmation",
  "Booking Date",
  "Number OF Room",
  "Nights",
  "Address",
] as const;

const HOTEL_BRANDS =
  /\b(Fairmont|Fairfield|Marriott|Trident|Taj|Oberoi|Hyatt|Hilton|ITC|Lemon Tree|Radisson|Novotel|Ibis|Sheraton|Westin|Courtyard|Holiday Inn|Leela|ITC\s+Grand)\b/gi;

const CHECK_IN_ANCHOR =
  /check[\s-]?in\s*[^\d]*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}(?:,\s*\d{1,2}:\d{2})?)/gi;

/** Split multi-page / multi-voucher PDF text into per-voucher chunks. */
export function splitIntoVoucherSections(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();

  const candidates: string[][] = [];

  const splitPatterns = [
    /\n(?=\s*Voucher\b)/i,
    /\n(?=\s*Voucher\s*(?:No|Number|#)\b)/i,
    /\n(?=--\s*\d+\s+of\s+\d+\s+--)/i,
    /\n(?=\s*Hotel\s*Confirmation\s*[:*])/i,
    /\n(?=\s*Guest\s*Name\s*[:*])/i,
    /\n(?=\s*Booking\s*Confirmation\b)/i,
    /\n(?=\s*HOTEL\s+VOUCHER\b)/i,
  ];

  for (const pattern of splitPatterns) {
    const parts = normalized
      .split(pattern)
      .map((part) => part.trim())
      .filter((part) => part.length > 60);

    if (parts.length > 1) candidates.push(mergeTinySections(parts));
  }

  const hotelBlocks = normalized
    .split(/\n(?=\s*(?:Hotel|HOTEL|Property)\s*[:*])/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 60);

  if (hotelBlocks.length > 1) {
    candidates.push(mergeTinySections(hotelBlocks));
  }

  const pageChunks = normalized
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(
      (part) =>
        part.length > 60 &&
        /check[\s-]?in|hotel|voucher|guest\s*name/i.test(part)
    );

  if (pageChunks.length > 1) {
    candidates.push(mergeTinySections(pageChunks));
  }

  const checkInSections = splitByCheckInAnchors(normalized);
  if (checkInSections.length > 1) {
    candidates.push(checkInSections);
  }

  const brandSections = splitByHotelBrandHeaders(normalized);
  if (brandSections.length > 1) {
    candidates.push(brandSections);
  }

  if (candidates.length === 0) return [normalized];

  return candidates.sort((a, b) => b.length - a.length)[0]!;
}

function splitByCheckInAnchors(text: string): string[] {
  const matches = [...text.matchAll(CHECK_IN_ANCHOR)];
  if (matches.length <= 1) return [];

  const sections: string[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const start = Math.max(0, (matches[i].index ?? 0) - 500);
    const end =
      i + 1 < matches.length
        ? (matches[i + 1].index ?? text.length)
        : text.length;
    const block = text.slice(start, end).trim();
    if (block.length > 60) sections.push(block);
  }

  return sections;
}

function splitByHotelBrandHeaders(text: string): string[] {
  const indices: number[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(HOTEL_BRANDS.source, HOTEL_BRANDS.flags);
  while ((m = re.exec(text)) !== null) {
    if (m.index !== undefined) indices.push(m.index);
  }

  if (indices.length <= 1) return [];

  const uniqueIndices = indices.filter(
    (idx, i) => i === 0 || idx - indices[i - 1] > 80
  );
  if (uniqueIndices.length <= 1) return [];

  const sections: string[] = [];
  for (let i = 0; i < uniqueIndices.length; i += 1) {
    const start = Math.max(0, uniqueIndices[i] - 200);
    const end =
      i + 1 < uniqueIndices.length
        ? uniqueIndices[i + 1]
        : text.length;
    const block = text.slice(start, end).trim();
    if (block.length > 60 && /check[\s-]?in|voucher|guest/i.test(block)) {
      sections.push(block);
    }
  }

  return sections;
}

function isValidHotelRecord(hotel: Record<string, string>): boolean {
  const name = pickRecord(hotel, "hotel");
  const city = pickRecord(hotel, "city");
  const checkIn = pickRecord(hotel, "checkIn");
  const checkOut = pickRecord(hotel, "checkOut");
  const voucher = pickRecord(hotel, "voucherNumber");

  if (/^(confirmation|amenities|as per hotel policy)$/i.test(name)) {
    return Boolean(city && (checkIn || checkOut));
  }

  return Boolean(
    (name || city) &&
      (checkIn || checkOut || voucher || pickRecord(hotel, "hotelConfirmation"))
  );
}

function hotelDedupeKey(record: Record<string, string>): string {
  return [
    pickRecord(record, "hotel"),
    pickRecord(record, "city"),
    pickRecord(record, "checkIn"),
    pickRecord(record, "checkOut"),
    pickRecord(record, "voucherNumber"),
    pickRecord(record, "hotelConfirmation"),
    pickRecord(record, "voucherIndex"),
  ]
    .join("|")
    .toLowerCase();
}

function extractHotelFromBlock(
  block: string,
  index: number
): Record<string, string> | null {
  if (
    !/hotel|resort|accommodation|voucher|check[\s-]?in|fairmont|marriott|trident|taj/i.test(
      block
    )
  ) {
    return null;
  }

  const kv = extractKeyValues(block, HOTEL_KEYS);

  const checkIn =
    block.match(
      /check[\s-]?in\s*[^\d]*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}(?:,\s*\d{1,2}:\d{2})?)/i
    )?.[1] ?? kv.Checkin ?? kv["Check-in"];

  const checkOut =
    block.match(
      /check[\s-]?out\s*[^\d]*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}(?:,\s*\d{1,2}:\d{2})?)/i
    )?.[1] ?? kv["Check out"] ?? kv["Check-out"];

  let hotel =
    kv.Hotel ??
    kv.Property ??
    block.match(/(?:Hotel|Property)\s*[:.*\s]+\s*([^\n]{3,80})/i)?.[1]?.trim() ??
    block.match(HOTEL_BRANDS)?.[0]?.trim();

  const city = sanitizePlaceName(
    kv.City ??
      block.match(/(?:City|Gity|qty)\s*[:*\s]+\s*([^\n]+)/i)?.[1]?.trim()
  );

  if (!hotel && !city && !checkIn) return null;
  if (hotel && /^(confirmation|amenities)$/i.test(hotel.trim())) {
    if (!city && !checkIn) return null;
    hotel = "";
  }

  const record = {
    voucherIndex: String(index + 1),
    hotel: hotel ?? "",
    city: city ?? "",
    guestName: kv["Guest Name"] ?? "",
    voucherNumber: kv["Voucher Number"] ?? "",
    hotelConfirmation: kv["Hotel Confirmation"] ?? "",
    bookingDate: kv["Booking Date"] ?? "",
    checkIn: checkIn ?? "",
    checkOut: checkOut ?? "",
    roomType: kv["Type of Room"] ?? "",
    meals: kv["Meal includes"] ?? "",
    nights: kv.Nights ?? "",
    rooms: kv["Number OF Room"] ?? "",
    address: kv.Address ?? "",
    documentRole: "hotel-voucher",
  };

  return isValidHotelRecord(record) ? record : null;
}

/** Extract all hotel stays from text (multi-voucher PDFs supported). */
export function extractAllHotels(text: string): Array<Record<string, string>> {
  const sections = splitIntoVoucherSections(text);
  const hotels: Array<Record<string, string>> = [];

  for (let i = 0; i < sections.length; i += 1) {
    const hotel = extractHotelFromBlock(sections[i], i);
    if (hotel) hotels.push(hotel);
  }

  if (hotels.length === 0) {
    const single = extractHotelFromBlock(text, 0);
    if (single) hotels.push(single);
  }

  return dedupeRecords(hotels, hotelDedupeKey);
}

export function countVoucherMarkers(text: string): number {
  const voucherWords = (text.match(/\bVoucher\b/gi) ?? []).length;
  const checkIns = (text.match(CHECK_IN_ANCHOR) ?? []).length;
  const guestBlocks = (text.match(/guest\s*name\s*[:*]/gi) ?? []).length;
  const hotelConf = (text.match(/hotel\s*confirmation\s*[:*]/gi) ?? []).length;

  return Math.max(voucherWords, checkIns, guestBlocks, hotelConf, 1);
}
