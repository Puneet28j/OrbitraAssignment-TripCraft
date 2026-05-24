/** Shared parsing helpers for all travel document extractors. */

export const DATE_PATTERNS = [
  /\b(\d{1,2}[\s./\-*]+[A-Za-z]{3,9}[\s./\-*]+\d{2,4}(?:,\s*\d{1,2}:\d{2})?)\b/g,
  /\b(\d{4}-\d{2}-\d{2})\b/g,
  /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}(?:,\s*\d{1,2}:\d{2})?)\b/gi,
  /\b(\d{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)\b/gi,
];

export const TIME_PATTERN = /\b(\d{1,2}:\d{2})\b/g;

const MONTHS =
  "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";

/** Reject OCR/amenity garbage masquerading as cities or stations. */
export function isValidPlaceName(value: string | undefined | null): boolean {
  if (!value) return false;
  const s = value.trim();
  if (s.length < 2 || s.length > 48) return false;

  const lower = s.toLowerCase();

  if (
    /iletries|kettle|amenit|facilit|wi-?fi|toilet|minibar|refrigerator|including|etc\)|\)\s*$|passenger\s*nam|boarding\s*at|room\s*facilit|om\s+facilit|todetries|qty\b|meal\s*includes|type\s*of\s*room|check[\s-]?out|check[\s-]?in|voucher\s*no|confirmation\s*no/i.test(
      lower
    )
  ) {
    return false;
  }

  if (/^[a-z]{0,2}\)|^\)|\($|^[^(]*\)\s*$/.test(s)) return false;

  const letters = (s.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  if (letters < Math.min(3, s.length) || letters < s.length * 0.45) return false;

  if (/^(from|to|date|time|gate|seat|flight|class|coach|bus|train|the|and|for)$/i.test(s)) {
    return false;
  }

  return true;
}

export function sanitizePlaceName(
  value: string | undefined | null
): string {
  if (!isValidPlaceName(value)) return "";
  return value!
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^to\s+/i, "")
    .replace(/\s*\)\s*$/g, "")
    .slice(0, 48);
}

export function unique(items: string[], max = 24): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
    if (out.length >= max) break;
  }
  return out;
}

export function matchAll(text: string, pattern: RegExp): string[] {
  const flags = pattern.flags.includes("g")
    ? pattern.flags
    : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1]) results.push(m[1].trim());
  }
  return results;
}

export function extractKeyValues(
  text: string,
  keys: readonly string[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const re = new RegExp(`${key}\\s*[:\\-*]\\s*([^\\n]{2,120})`, "i");
    const m = text.match(re);
    if (m?.[1]) out[key] = m[1].trim().replace(/\s+/g, " ");
  }
  return out;
}

export function titleCase(value: string): string {
  return value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function extractAllDates(text: string, max = 16): string[] {
  return unique(DATE_PATTERNS.flatMap((p) => matchAll(text, p)), max);
}

export function extractAllTimes(text: string, max = 12): string[] {
  return unique(matchAll(text, TIME_PATTERN), max);
}

export function extractPassengerNames(text: string): string[] {
  const names: string[] = [];
  const patterns = [
    /(?:passenger|guest|pax|traveler|traveller)\s*name\s*[:\-]?\s*([^\n]{3,60})/gi,
    /(?:mr|mrs|ms|dr)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/g,
  ];
  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      if (m[1]) names.push(m[1].trim().replace(/\s+/g, " "));
    }
  }
  return unique(names, 8);
}

export function extractBookingRefs(text: string, max = 12): string[] {
  return unique(
    matchAll(
      text,
      /(?:confirmation|booking|reservation|voucher|pnr|record\s*locator|ref(?:erence)?)\s*(?:no\.?|number|#)?\s*[:\-#]?\s*([A-Z0-9]{4,16})/gi
    ),
    max
  );
}

export function extractCompactDate(text: string): string {
  const full = text.match(
    new RegExp(
      `\\b(\\d{1,2})\\s*(${MONTHS})[a-z]*\\s*(\\d{2,4})?\\b`,
      "i"
    )
  );
  if (full) {
    const year = full[3] ? ` ${full[3]}` : "";
    return `${full[1]} ${titleCase(full[2])}${year}`.trim();
  }
  const compact = text.match(
    new RegExp(`\\b(\\d{2})\\s*(${MONTHS})[a-z]{0,3}\\b`, "i")
  );
  if (compact) return `${compact[1]} ${titleCase(compact[2])}`;
  return "";
}

export function pickRecord(
  record: Record<string, string>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const val = record[key]?.trim();
    if (val) return val;
  }
  return "";
}

export function dedupeRecords(
  records: Array<Record<string, string>>,
  keyFn: (r: Record<string, string>) => string
): Array<Record<string, string>> {
  const seen = new Set<string>();
  const out: Array<Record<string, string>> = [];
  for (const r of records) {
    const key = keyFn(r).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export function mergeTinySections(parts: string[]): string[] {
  const merged: string[] = [];
  for (const part of parts) {
    if (merged.length > 0 && part.length < 120) {
      merged[merged.length - 1] += `\n${part}`;
    } else {
      merged.push(part);
    }
  }
  return merged.filter((p) => p.length > 40);
}
