import env from "../../config/env.js";

export type ExtractionMode = "fast" | "robust";

export function getExtractionMode(): ExtractionMode {
  return env.EXTRACTION_MODE;
}

export function isFastExtraction(): boolean {
  return env.EXTRACTION_MODE === "fast";
}
