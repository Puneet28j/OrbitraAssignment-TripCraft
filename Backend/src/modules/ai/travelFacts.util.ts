/**
 * Travel fact extraction — re-exports orchestrator API.
 * Handles boarding passes, flight/hotel/train/bus tickets, multi-page PDFs.
 */

export type {
  TravelDocumentKind,
  TravelFacts,
  LegacyDocumentType,
} from "./travelFacts.types.js";

export {
  extractTravelFacts,
  shouldRefreshCachedFacts,
  mergeBarcodeIntoFacts,
} from "./travelFactsOrchestrator.util.js";

export { splitIntoVoucherSections, countVoucherMarkers } from "./hotelVoucher.util.js";
