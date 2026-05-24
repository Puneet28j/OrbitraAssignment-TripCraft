import {
  dedupeRecords,
  extractAllDates,
  extractAllTimes,
  extractKeyValues,
  isValidPlaceName,
  pickRecord,
  sanitizePlaceName,
} from "./travelExtract.shared.js";

const TRAIN_KEYS = [
  "Train",
  "Train No",
  "Train Number",
  "PNR",
  "From",
  "To",
  "Departure",
  "Arrival",
  "Class",
  "Coach",
  "Berth",
  "Seat",
  "Date of Journey",
] as const;

function isTrainDocument(text: string): boolean {
  if (/\birctc\b/i.test(text)) return true;
  if (/\btrain\s*(?:no\.?|number|#)\s*[:\-]/i.test(text)) return true;
  if (
    /\b(?:rajdhani|duronto|shatabdi|superfast|express)\b/i.test(text) &&
    /\btrain\b/i.test(text)
  ) {
    return true;
  }
  if (/\btrain\s+ticket\b/i.test(text)) return true;
  return false;
}

function extractPlaceAfterLabel(
  block: string,
  label: "from" | "to"
): string {
  const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const labelRe =
    label === "from"
      ? /^(?:from|origin|departure\s*station)$/i
      : /^(?:to|destination|arrival\s*station)$/i;

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
      ? block.match(/(?:^|\n)\s*from\s*[:\-]\s*([^\n]{2,48})/im)?.[1]
      : block.match(/(?:^|\n)\s*to\s*[:\-]\s*([^\n]{2,48})/im)?.[1];

  return sanitizePlaceName(inline);
}

function extractTrainFromBlock(block: string): Record<string, string> | null {
  const kv = extractKeyValues(block, TRAIN_KEYS);

  const from = sanitizePlaceName(kv.From) || extractPlaceAfterLabel(block, "from");
  const to = sanitizePlaceName(kv.To) || extractPlaceAfterLabel(block, "to");
  const trainNumber =
    kv["Train No"] ??
    kv["Train Number"] ??
    kv.Train ??
    block.match(/train\s*(?:no\.?|number)?\s*[:\-]?\s*([A-Z0-9]{3,10})/i)?.[1];

  if (!from && !to && !trainNumber) return null;
  if (!from && !to) return null;

  const dates = extractAllDates(block, 2);
  const times = extractAllTimes(block, 4);

  return {
    from,
    to,
    trainNumber: trainNumber ?? "",
    pnr: kv.PNR ?? "",
    travelClass: kv.Class ?? "",
    coach: kv.Coach ?? "",
    berth: kv.Berth ?? "",
    seat: kv.Seat ?? "",
    date: kv["Date of Journey"] ?? dates[0] ?? "",
    departureTime: kv.Departure ?? times[0] ?? "",
    arrivalTime: kv.Arrival ?? times[1] ?? "",
    documentRole: "train-ticket",
  };
}

export function extractAllTrains(text: string): Array<Record<string, string>> {
  if (!isTrainDocument(text)) return [];

  const sections = text
    .split(/\n(?=\s*(?:Train|PNR|IRCTC)\b)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 40);

  const blocks = sections.length > 1 ? sections : [text];
  const trains: Array<Record<string, string>> = [];

  for (const block of blocks) {
    const train = extractTrainFromBlock(block);
    if (train && (isValidPlaceName(train.from) || isValidPlaceName(train.to))) {
      trains.push(train);
    }
  }

  return dedupeRecords(trains, (r) =>
    [
      pickRecord(r, "from"),
      pickRecord(r, "to"),
      pickRecord(r, "date"),
      pickRecord(r, "trainNumber"),
    ].join("|")
  );
}
