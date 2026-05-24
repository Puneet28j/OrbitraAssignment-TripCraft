import { isValidPlaceName } from "./travelExtract.shared.js";
import type { ItineraryResponse } from "./itinerary.schema.js";
import type { DocumentForAI } from "./documentInputs.util.js";
import { collectMergedFacts } from "./mergedFacts.util.js";
import type { MasterBookingInventory } from "./mergedFacts.util.js";
import type { TravelFacts } from "./travelFacts.types.js";

type Activity = ItineraryResponse["days"][0]["activities"][0];

const CITY_SIGHTS: Record<string, string> = {
  jaipur: "Amber Fort or Hawa Mahal",
  jodhpur: "Mehrangarh Fort",
  jaisalmer: "Jaisalmer Fort or Sam Sand Dunes",
  udaipur: "Lake Pichola or City Palace",
  paris: "Iconic Paris landmarks near your route",
  "rio de janeiro": "Copacabana or Christ the Redeemer area",
};

function inferCityFromDay(day: ItineraryResponse["days"][0]): string {
  for (const act of day.activities) {
    const loc = act.location?.trim();
    if (loc && isValidPlaceName(loc)) return loc;
    const title = act.title ?? "";
    const hotel = title.match(/(?:at|in|—)\s+(.+)/i)?.[1];
    if (hotel) return hotel;
  }
  return "";
}

function cityKey(city: string): string {
  return city.toLowerCase().replace(/[^a-z\s]/g, "").trim();
}

function findSightseeing(city: string): string | null {
  const key = cityKey(city);
  for (const [name, sight] of Object.entries(CITY_SIGHTS)) {
    if (key.includes(name) || name.includes(key.split(" ")[0] ?? "")) {
      return sight;
    }
  }
  return null;
}

function hasActivityMatching(
  activities: Activity[],
  pattern: RegExp
): boolean {
  return activities.some(
    (a) => pattern.test(a.title) || pattern.test(a.description ?? "")
  );
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

function dayNeedsEnrichment(day: ItineraryResponse["days"][0]): boolean {
  const activities = day.activities;
  if (activities.length < 4) return true;
  const withLocation = activities.filter((a) => (a.location?.trim().length ?? 0) > 2);
  if (withLocation.length < Math.min(3, activities.length)) return true;
  const withDescription = activities.filter(
    (a) => (a.description?.trim().length ?? 0) > 25
  );
  if (withDescription.length < Math.min(3, activities.length)) return true;
  return false;
}

/** Build route-style destination from all bookings (multi-doc trips). */
export function buildRouteDestination(
  inventory: MasterBookingInventory
): string {
  const places: string[] = [];
  const seen = new Set<string>();

  const add = (name: string | undefined) => {
    const n = name?.trim();
    if (!n || n.length < 2) return;
    const key = n.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    places.push(n);
  };

  for (const f of inventory.flights) {
    add(f.from);
    add(f.to);
  }
  for (const h of inventory.hotels) {
    add(h.city);
    if (!h.city) add(h.hotel);
  }
  for (const t of inventory.trains) {
    add(t.from);
    add(t.to);
  }
  for (const tr of inventory.transports) {
    add(tr.from);
    add(tr.to);
  }

  if (places.length === 0) return "";
  return places.slice(0, 8).join(" → ");
}

function applyTripMetadata(
  itinerary: ItineraryResponse,
  inventory: MasterBookingInventory,
  documentCount: number
): ItineraryResponse {
  const routeDest = buildRouteDestination(inventory);
  if (!routeDest) return itinerary;

  const currentDest = itinerary.destination?.trim() ?? "";
  const shouldReplaceDest =
    documentCount > 1 ||
    !currentDest ||
    currentDest.length < 12 ||
    (routeDest.split("→").length > 1 &&
      routeDest.split("→").length > currentDest.split("→").length);

  let title = itinerary.title?.trim() ?? "";
  if (
    documentCount > 1 &&
    routeDest.split("→").length >= 2 &&
    !title.toLowerCase().includes(routeDest.split("→")[0]?.trim().toLowerCase() ?? "")
  ) {
    const first = routeDest.split("→")[0]?.trim();
    const last = routeDest.split("→").pop()?.trim();
    if (first && last && first !== last) {
      title = `${first} to ${last}`;
    }
  }

  let summary = itinerary.summary?.trim() ?? "";
  if (documentCount > 1 && summary.length < 80 && routeDest) {
    summary = `A combined itinerary covering ${routeDest.replace(/ → /g, ", ")}. All bookings from your ${documentCount} uploaded documents are included below.`;
  }

  return {
    ...itinerary,
    title: title || itinerary.title,
    destination: shouldReplaceDest ? routeDest.slice(0, 120) : itinerary.destination,
    summary: summary || itinerary.summary,
  };
}

/** Fast local pass: pad sparse days with logical extras (no extra AI call). */
function enrichDay(
  day: ItineraryResponse["days"][0],
  facts: {
    hotels: TravelFacts["hotels"];
    flights: TravelFacts["flights"];
    trains: TravelFacts["trains"];
  }
): ItineraryResponse["days"][0] {
  if (!dayNeedsEnrichment(day)) return day;

  const activities = [...day.activities];
  const city = inferCityFromDay(day) || facts.hotels[0]?.city || "";
  const sight = city ? findSightseeing(city) : null;
  const additions: Activity[] = [];

  const isCheckInDay = hasActivityMatching(activities, /check[\s-]?in/i);
  const isCheckOutDay = hasActivityMatching(activities, /check[\s-]?out/i);
  const isFlightDay = activities.some((a) => a.type === "flight");
  const hasBreakfast = facts.hotels.some((h) =>
    /breakfast/i.test(h.meals ?? "")
  );
  const hasDinner = facts.hotels.some((h) => /dinner/i.test(h.meals ?? ""));

  if (isFlightDay && !hasActivityMatching(activities, /airport|security|boarding/i)) {
    if (!hasActivityMatching(activities, /arrive|reach|depart/i)) {
      additions.push(
        makeActivity({
          time: "06:30",
          type: "transport",
          title: "Depart for airport",
          description:
            "Allow extra time for traffic and security. Keep travel documents and boarding pass ready.",
          location: city || null,
        })
      );
    }
  }

  if (isCheckInDay) {
    if (!hasActivityMatching(activities, /transfer|arrival/i)) {
      const hotelName = facts.hotels[0]?.hotel || "hotel";
      additions.push(
        makeActivity({
          time: "13:00",
          type: "transport",
          title: `Transfer to ${hotelName}`,
          description:
            `Travel to ${hotelName}${city ? ` in ${city}` : ""}. Confirm address and keep your voucher handy.`,
          location: city || hotelName || null,
        })
      );
    }
    if (hasDinner && !hasActivityMatching(activities, /dinner/i)) {
      additions.push(
        makeActivity({
          time: "19:30",
          type: "dining",
          title: "Dinner at hotel",
          description:
            "Dinner is included per your voucher. Check with the front desk for restaurant timings.",
          location: city || null,
          bookingRef: null,
        })
      );
    }
  }

  if (isCheckOutDay) {
    if (hasBreakfast && !hasActivityMatching(activities, /breakfast/i)) {
      additions.push(
        makeActivity({
          time: "08:00",
          type: "dining",
          title: "Breakfast at hotel",
          description: "Breakfast included with your stay. Pack before checkout if leaving early.",
          location: city || null,
        })
      );
    }
    if (!hasActivityMatching(activities, /transfer|depart|next/i)) {
      additions.push(
        makeActivity({
          time: "10:30",
          type: "transport",
          title: "Departure transfer",
          description:
            "Check out and head to your next destination or airport. Keep luggage tags and vouchers accessible.",
          location: city || null,
        })
      );
    }
  }

  if (
    sight &&
    !isFlightDay &&
    activities.length + additions.length < 5 &&
    !hasActivityMatching(activities, /sight|fort|palace|beach|explor/i)
  ) {
    additions.push(
      makeActivity({
        time: "16:00",
        type: "sightseeing",
        title: `Explore ${sight}`,
        description: `Optional visit to ${sight}. Plan 1–2 hours; carry water and local currency.`,
        location: city || null,
        bookingRef: null,
      })
    );
  }

  if (activities.length + additions.length < 4 && city) {
    additions.push(
      makeActivity({
        time: "11:00",
        type: "activity",
        title: `Morning in ${city}`,
        description:
          "Free time to rest or explore nearby markets and cafés at your own pace.",
        location: city,
        bookingRef: null,
      })
    );
  }

  const merged = [...activities, ...additions];
  merged.sort((a, b) => {
    const ta = a.time?.match(/(\d{1,2}):(\d{2})/);
    const tb = b.time?.match(/(\d{1,2}):(\d{2})/);
    if (!ta) return 1;
    if (!tb) return -1;
    return (
      parseInt(ta[1], 10) * 60 +
      parseInt(ta[2], 10) -
      (parseInt(tb[1], 10) * 60 + parseInt(tb[2], 10))
    );
  });

  return { ...day, activities: merged };
}

function collectFactsFromDocuments(documents: DocumentForAI[]): {
  hotels: TravelFacts["hotels"];
  flights: TravelFacts["flights"];
  trains: TravelFacts["trains"];
} {
  const merged = collectMergedFacts(documents);
  return {
    hotels: merged.hotels,
    flights: merged.flights,
    trains: merged.trains ?? [],
  };
}

/** Enrich sparse days and fix multi-doc title/destination without a second AI call. */
export function enrichItineraryFromFacts(
  itinerary: ItineraryResponse,
  documents: DocumentForAI[],
  inventory?: MasterBookingInventory
): ItineraryResponse {
  const facts = collectFactsFromDocuments(documents);

  let result: ItineraryResponse = {
    ...itinerary,
    days: itinerary.days.map((day) => enrichDay(day, facts)),
  };

  if (inventory) {
    result = applyTripMetadata(result, inventory, documents.length);
  }

  return result;
}
