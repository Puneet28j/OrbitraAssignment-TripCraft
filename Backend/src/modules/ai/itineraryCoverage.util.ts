import type { ItineraryResponse } from "./itinerary.schema.js";
import { isValidPlaceName } from "./travelExtract.shared.js";
import type {
  MasterBookingInventory,
  MasterFlightBooking,
  MasterHotelBooking,
  MasterTrainBooking,
} from "./mergedFacts.util.js";

type Activity = ItineraryResponse["days"][0]["activities"][0];
type Day = ItineraryResponse["days"][0];

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function itineraryContains(
  itinerary: ItineraryResponse,
  ...needles: string[]
): boolean {
  const tokens = needles
    .map((n) => normalizeToken(n))
    .filter((n) => n.length >= 4);

  if (tokens.length === 0) return false;

  const haystack = [
    itinerary.title,
    itinerary.destination,
    itinerary.summary,
    ...itinerary.days.flatMap((d) => [
      d.title,
      d.date ?? "",
      ...d.activities.flatMap((a) => [
        a.title,
        a.description,
        a.location ?? "",
        a.bookingRef ?? "",
      ]),
    ]),
  ]
    .join(" ")
    .toLowerCase();

  return tokens.some((t) => haystack.includes(t));
}

function makeActivity(
  partial: Partial<Activity> & Pick<Activity, "title" | "type">
): Activity {
  return {
    time: partial.time ?? null,
    type: partial.type,
    title: partial.title,
    description: partial.description ?? "",
    location: partial.location ?? null,
    bookingRef: partial.bookingRef ?? null,
    duration: partial.duration ?? null,
  };
}

function buildHotelCheckInDay(
  booking: MasterHotelBooking,
  dayNumber: number
): Day {
  const ref = booking.confirmation || booking.voucherNumber || null;
  const location = booking.city || booking.hotel || null;

  return {
    dayNumber,
    date: null,
    title: `Arrival in ${booking.city || booking.hotel || "destination"}`,
    activities: [
      makeActivity({
        time: "12:00",
        type: "transport",
        title: `Transfer to ${booking.hotel || "hotel"}`,
        description: `Travel to ${booking.hotel || "your hotel"} in ${booking.city || "the city"}. Keep voucher ${booking.voucherNumber || "handy"}.`,
        location,
      }),
      makeActivity({
        time: "14:00",
        type: "hotel",
        title: `Check in — ${booking.hotel || "Hotel"}`,
        description: `Guest: ${booking.guestName || "as per voucher"}. Room: ${booking.roomType || "as booked"}. Check-in: ${booking.checkIn || "per voucher"}.`,
        location,
        bookingRef: ref,
      }),
      ...(booking.meals && /dinner/i.test(booking.meals)
        ? [
            makeActivity({
              time: "19:30",
              type: "dining",
              title: "Dinner at hotel",
              description: `Meals included: ${booking.meals}.`,
              location,
            }),
          ]
        : []),
      makeActivity({
        time: "21:00",
        type: "activity",
        title: `Evening in ${booking.city || "town"}`,
        description: "Relax after travel or explore the area near your hotel.",
        location,
      }),
    ],
  };
}

function buildHotelCheckOutDay(
  booking: MasterHotelBooking,
  dayNumber: number
): Day {
  const ref = booking.confirmation || booking.voucherNumber || null;
  const location = booking.city || booking.hotel || null;

  return {
    dayNumber,
    date: null,
    title: `Departure from ${booking.city || booking.hotel || "hotel"}`,
    activities: [
      ...(booking.meals && /breakfast/i.test(booking.meals)
        ? [
            makeActivity({
              time: "08:00",
              type: "dining",
              title: "Breakfast at hotel",
              description: `Included: ${booking.meals}.`,
              location,
            }),
          ]
        : []),
      makeActivity({
        time: "10:00",
        type: "hotel",
        title: `Check out — ${booking.hotel || "Hotel"}`,
        description: `Check-out: ${booking.checkOut || "per voucher"}. Confirm bill and collect belongings.`,
        location,
        bookingRef: ref,
      }),
      makeActivity({
        time: "11:30",
        type: "transport",
        title: "Transfer to next destination",
        description: "Head to your next hotel or airport as per your trip plan.",
        location,
      }),
    ],
  };
}

function buildFlightDay(
  booking: MasterFlightBooking,
  dayNumber: number
): Day {
  const route = `${booking.from || "Origin"} → ${booking.to || "Destination"}`;
  const flightLabel = booking.flightNumber
    ? `Flight ${booking.flightNumber}`
    : "International flight";

  return {
    dayNumber,
    date: null,
    title: `${flightLabel}: ${route}`,
    activities: [
      makeActivity({
        time: "06:00",
        type: "transport",
        title: `Depart for ${booking.from || "airport"}`,
        description:
          "Head to the airport with passport and boarding pass. Allow extra time for security.",
        location: booking.from || null,
      }),
      makeActivity({
        time: "07:00",
        type: "activity",
        title: "Airport check-in and security",
        description: booking.gate
          ? `Proceed to gate ${booking.gate} after check-in.`
          : "Complete check-in and security screening.",
        location: booking.from || null,
      }),
      makeActivity({
        time: booking.departureTime || "09:00",
        type: "flight",
        title: `${flightLabel} — ${route}`,
        description: [
          booking.carrier ? `Carrier: ${booking.carrier}.` : "",
          booking.gate ? `Gate ${booking.gate}.` : "",
          booking.seat ? `Seat ${booking.seat}.` : "",
          booking.date ? `Date: ${booking.date}.` : "",
        ]
          .filter(Boolean)
          .join(" "),
        location: booking.from || null,
        bookingRef: booking.flightNumber || null,
      }),
      makeActivity({
        time: "14:00",
        type: "transport",
        title: `Arrive in ${booking.to || "destination"}`,
        description: `Land in ${booking.to || "your destination"}. Collect baggage and continue to your next connection or hotel.`,
        location: booking.to || null,
      }),
    ],
  };
}

function isHotelCovered(
  itinerary: ItineraryResponse,
  booking: MasterHotelBooking
): boolean {
  const needles = [
    booking.hotel,
    booking.confirmation,
    booking.voucherNumber,
    booking.city,
  ].filter((n) => n && n.length > 3);

  return itineraryContains(itinerary, ...needles);
}

function buildTrainDay(booking: MasterTrainBooking, dayNumber: number): Day {
  const route = `${booking.from || "Station A"} → ${booking.to || "Station B"}`;
  return {
    dayNumber,
    date: null,
    title: `Train: ${route}`,
    activities: [
      makeActivity({
        time: booking.departureTime || "08:00",
        type: "transport",
        title: `Train ${booking.trainNumber || ""} — ${route}`.trim(),
        description: [
          booking.travelClass ? `Class: ${booking.travelClass}.` : "",
          booking.pnr ? `PNR: ${booking.pnr}.` : "",
          booking.date ? `Date: ${booking.date}.` : "",
        ]
          .filter(Boolean)
          .join(" "),
        location: booking.from || null,
        bookingRef: booking.pnr || null,
      }),
      makeActivity({
        time: "12:00",
        type: "transport",
        title: `Arrive at ${booking.to || "destination"}`,
        description: "Disembark and proceed to your hotel or next connection.",
        location: booking.to || null,
      }),
    ],
  };
}

function isTrainCovered(
  itinerary: ItineraryResponse,
  booking: MasterTrainBooking
): boolean {
  return itineraryContains(
    itinerary,
    booking.from ?? "",
    booking.to ?? "",
    booking.trainNumber ?? "",
    "train"
  );
}

function isFlightCovered(
  itinerary: ItineraryResponse,
  booking: MasterFlightBooking
): boolean {
  const needles = [
    booking.from,
    booking.to,
    booking.flightNumber,
    booking.flightNumber?.replace(/\s/g, ""),
    "Paris",
    "Rio",
  ].filter((n) => n && n.length > 3) as string[];

  if (needles.length === 0) return false;

  const hasRoute =
    (!booking.from || itineraryContains(itinerary, booking.from)) &&
    (!booking.to || itineraryContains(itinerary, booking.to));

  return (
    hasRoute ||
    itineraryContains(itinerary, booking.flightNumber ?? "", "boarding", "gate")
  );
}

/**
 * If the model skipped bookings, append days so every hotel/flight from facts appears.
 */
export function ensureAllBookingsCovered(
  itinerary: ItineraryResponse,
  inventory: MasterBookingInventory
): ItineraryResponse {
  const extraDays: Day[] = [];
  let nextDayNumber = itinerary.days.length + 1;

  for (const hotel of inventory.hotels) {
    if (isHotelCovered(itinerary, hotel)) continue;

    extraDays.push(buildHotelCheckInDay(hotel, nextDayNumber));
    nextDayNumber += 1;

    if (hotel.checkOut && hotel.checkOut !== hotel.checkIn) {
      extraDays.push(buildHotelCheckOutDay(hotel, nextDayNumber));
      nextDayNumber += 1;
    }
  }

  for (const flight of inventory.flights) {
    if (isFlightCovered(itinerary, flight)) continue;
    extraDays.push(buildFlightDay(flight, nextDayNumber));
    nextDayNumber += 1;
  }

  for (const train of inventory.trains) {
    if (
      !isValidPlaceName(train.from) &&
      !isValidPlaceName(train.to)
    ) {
      continue;
    }
    if (isTrainCovered(itinerary, train)) continue;
    extraDays.push(buildTrainDay(train, nextDayNumber));
    nextDayNumber += 1;
  }

  if (extraDays.length === 0) {
    return itinerary;
  }

  const mergedDays = [...itinerary.days, ...extraDays].map((day, index) => ({
    ...day,
    dayNumber: index + 1,
  }));

  const addedSummary =
    extraDays.length > 0
      ? ` Includes all bookings from your ${inventory.documentCount} document(s).`
      : "";

  return {
    ...itinerary,
    summary:
      (itinerary.summary || "").trim() +
      (addedSummary && !itinerary.summary?.includes("from your documents")
        ? addedSummary
        : ""),
    days: mergedDays,
  };
}
