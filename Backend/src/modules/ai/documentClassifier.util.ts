import { isBoardingPassText } from "./boardingPass.util.js";

export type TravelDocumentKind =
  | "boarding_pass"
  | "flight_ticket"
  | "hotel_voucher"
  | "train_ticket"
  | "bus_ticket"
  | "car_rental"
  | "travel_other"
  | "mixed";

const SIGNALS: Array<{
  kind: TravelDocumentKind;
  pattern: RegExp;
  weight: number;
}> = [
  {
    kind: "boarding_pass",
    pattern: /boarding\s*pass|boardingpass/i,
    weight: 5,
  },
  {
    kind: "flight_ticket",
    pattern:
      /e-?ticket|eticket|itinerary|pnr|record\s*locator|airline\s*confirmation/i,
    weight: 4,
  },
  {
    kind: "flight_ticket",
    pattern: /\bflight\b|\bairline\b|\bdeparture\b|\barrival\b/i,
    weight: 2,
  },
  { kind: "hotel_voucher", pattern: /\bvoucher\b/i, weight: 3 },
  {
    kind: "hotel_voucher",
    pattern: /check[\s-]?in|check[\s-]?out|hotel\s*confirmation/i,
    weight: 3,
  },
  {
    kind: "hotel_voucher",
    pattern: /\bhotel\b|\bresort\b|\baccommodation\b/i,
    weight: 2,
  },
  {
    kind: "train_ticket",
    pattern: /\btrain\b|\brail\b|\birctc\b|\bberth\b|\bsleeper\b/i,
    weight: 4,
  },
  {
    kind: "bus_ticket",
    pattern: /\bbus\s*(?:ticket|from|to|no)|\bcoach\s*ticket\b/i,
    weight: 3,
  },
  {
    kind: "car_rental",
    pattern: /car\s*rental|rental\s*car|hire\s*car/i,
    weight: 4,
  },
  {
    kind: "travel_other",
    pattern: /tour|excursion|activity|transfer\s*service|visa/i,
    weight: 2,
  },
];

export function classifyTravelDocument(text: string): {
  primary: TravelDocumentKind;
  detected: TravelDocumentKind[];
  confidence: number;
} {
  const normalized = text.replace(/\r\n/g, "\n");

  if (isBoardingPassText(normalized)) {
    return {
      primary: "boarding_pass",
      detected: ["boarding_pass"],
      confidence: 92,
    };
  }

  const scores = new Map<TravelDocumentKind, number>();

  for (const { kind, pattern, weight } of SIGNALS) {
    if (pattern.test(normalized)) {
      scores.set(kind, (scores.get(kind) ?? 0) + weight);
    }
  }

  if (/\bfrom\b/i.test(normalized) && /\bto\b/i.test(normalized)) {
    scores.set("flight_ticket", (scores.get("flight_ticket") ?? 0) + 1);
  }

  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const detected = sorted
    .filter(([, score]) => score >= 2)
    .map(([kind]) => kind);

  const bestScore = sorted.length > 0 ? sorted[0][1] : 0;
  const maxScore = SIGNALS.reduce((sum, signal) => sum + signal.weight, 0);
  const confidence = Math.min(100, Math.round((bestScore / maxScore) * 100));

  if (detected.length === 0) {
    return {
      primary: "travel_other",
      detected: ["travel_other"],
      confidence: 15,
    };
  }

  if (detected.length > 1) {
    const hasHotel = detected.includes("hotel_voucher");
    const hasFlight =
      detected.includes("flight_ticket") || detected.includes("boarding_pass");
    if (hasHotel && hasFlight) {
      return { primary: "mixed", detected, confidence };
    }
  }

  return {
    primary: detected.length > 1 ? "mixed" : detected[0],
    detected,
    confidence,
  };
}
