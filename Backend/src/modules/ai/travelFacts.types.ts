import type { TravelDocumentKind } from "./documentClassifier.util.js";

export type { TravelDocumentKind };

/** @deprecated Use documentKind — kept for existing consumers */
export type LegacyDocumentType =
  | "flight"
  | "hotel"
  | "train"
  | "multi"
  | "other";

export interface TravelFacts {
  documentType: LegacyDocumentType;
  documentKind: TravelDocumentKind;
  detectedKinds: TravelDocumentKind[];
  classificationConfidence?: number;
  passengerNames: string[];
  flights: Array<Record<string, string>>;
  hotels: Array<Record<string, string>>;
  trains: Array<Record<string, string>>;
  transports: Array<Record<string, string>>;
  dates: string[];
  times: string[];
  locations: string[];
  bookingRefs: string[];
  meals: string[];
  notes: string[];
  voucherCount?: number;
}
