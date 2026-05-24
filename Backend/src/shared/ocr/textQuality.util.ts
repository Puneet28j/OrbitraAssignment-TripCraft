/** pdf-parse pageJoiner markers when the text layer is empty. */
const PAGE_MARKER_PATTERN = /^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gim;

/** Minimum quality score for extraction to be considered usable. */
export const MIN_TEXT_QUALITY_SCORE = 40;

export function stripPageMarkers(text: string): string {
  return text.replace(PAGE_MARKER_PATTERN, "").trim();
}

/**
 * Score extracted text: rewards length, real words, and penalizes garbage OCR.
 */
export function scoreExtractedText(text: string): number {
  const body = stripPageMarkers(text.trim());
  if (!body) return 0;

  if (body.length < 25) return body.length * 0.4;

  const meaningfulChars =
    body.match(/[a-zA-Z0-9@:./\-,#$%&*+()\s]/g)?.length ?? 0;
  const charRatio = meaningfulChars / body.length;

  const words = body.match(/[a-zA-Z]{2,}/g) ?? [];
  const wordScore = Math.min(words.length * 10, 150);

  const dates = body.match(/\b\d{1,2}[\s./-][A-Za-z]{3,}[\s./-]\d{2,4}\b/g);
  const dateBonus = (dates?.length ?? 0) * 15;

  const singleLetterTokens = body.match(/\b[a-zA-Z]\b/g)?.length ?? 0;
  const garbagePenalty = singleLetterTokens * 4;

  return (
    body.length * charRatio * 0.45 + wordScore + dateBonus - garbagePenalty
  );
}

export function isUsableExtractedText(text: string): boolean {
  return scoreExtractedText(text) >= MIN_TEXT_QUALITY_SCORE;
}

export function pickBestExtractedText(
  candidates: Array<{ text: string; label?: string }>
): string {
  let best = "";
  let bestScore = 0;

  for (const candidate of candidates) {
    const trimmed = candidate.text.trim();
    if (!trimmed) continue;
    const score = scoreExtractedText(trimmed);
    if (score > bestScore) {
      bestScore = score;
      best = trimmed;
    }
  }

  return best;
}
