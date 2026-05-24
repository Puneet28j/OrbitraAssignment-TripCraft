/**
 * Text cleaner — strips noise from raw OCR output.
 * Key field extraction is handled by travelFactsOrchestrator, NOT here.
 */

/* ── Whitespace normaliser ─────────────────────────── */

function normalizeWhitespace(s: string): string {
  return s
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/* ── Noise removal ─────────────────────────────────── */

function removeWatermarksAndUrls(text: string): string {
  return text
    .replace(/download(ed)? from[:\s\-]*[A-Za-z0-9.\-/]+/gi, "")
    .replace(/www\.[a-z0-9.\-_/]+/gi, "")
    .replace(/https?:\/\/[\S]+/gi, "")
    .replace(/copyright[:\s\-]*[^\n]+/gi, "")
    .replace(/dreamstime\.com/gi, "");
}

function dedupeHeaders(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    if (!line) continue;
    const key = line.toUpperCase();
    if (seen.has(key) && key.length < 40) continue;
    seen.add(key);
    out.push(line);
  }
  return out.join("\n");
}

function removeNoiseLines(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Skip pure garbage
    if (/^[^A-Za-z0-9]{1,}$/.test(trimmed)) continue;
    if (/^[A-Za-z]{1,3}\s*$/.test(trimmed)) continue;
    // Skip lines with excessive non-alphanumeric characters
    const nonAlpha = (trimmed.match(/[^A-Za-z0-9\s:,.\-]/g) || []).length;
    if (nonAlpha > Math.max(3, trimmed.length * 0.2)) continue;
    out.push(trimmed);
  }
  return out.join("\n");
}

/* ── Public API ────────────────────────────────────── */

/**
 * Clean raw OCR text: remove watermarks, dedupe headers, strip noise lines.
 * Returns a compact cleaned version suitable for AI prompts.
 *
 * @param rawText - Raw OCR output
 * @param _documentKind - Optional document kind (reserved for future use)
 */
export function cleanRawText(rawText: string, _documentKind?: string): string {
  if (!rawText) return "";

  let text = rawText;
  text = removeWatermarksAndUrls(text);
  text = dedupeHeaders(text);
  text = removeNoiseLines(text);
  text = normalizeWhitespace(text);

  // Return a compact summary (first 8 meaningful lines)
  return text.split("\n").slice(0, 8).join(" | ");
}

export default { cleanRawText };
