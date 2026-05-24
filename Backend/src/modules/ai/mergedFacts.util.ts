import { extractAllFlights } from "./flightTicket.util.js";
import { isValidPlaceName } from "./travelExtract.shared.js";
import type { DocumentForAI } from "./documentInputs.util.js";
import type { TravelFacts } from "./travelFacts.types.js";

export interface MasterHotelBooking {
  id: string;
  sourceDocument: string;
  sourceDocumentId: string;
  hotel: string;
  city: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  confirmation: string;
  voucherNumber: string;
  roomType: string;
  meals: string;
  nights: string;
}

export interface MasterFlightBooking {
  id: string;
  sourceDocument: string;
  sourceDocumentId: string;
  from: string;
  to: string;
  flightNumber: string;
  date: string;
  departureTime: string;
  gate: string;
  seat: string;
  carrier: string;
  pnr: string;
}

export interface MasterTrainBooking {
  id: string;
  sourceDocument: string;
  sourceDocumentId: string;
  from: string;
  to: string;
  trainNumber: string;
  date: string;
  departureTime: string;
  pnr: string;
  travelClass: string;
}

export interface MasterTransportBooking {
  id: string;
  sourceDocument: string;
  sourceDocumentId: string;
  type: string;
  from: string;
  to: string;
  date: string;
  time: string;
  operator: string;
}

export interface MasterBookingInventory {
  documentCount: number;
  hotelCount: number;
  flightCount: number;
  trainCount: number;
  transportCount: number;
  passengerNames: string[];
  hotels: MasterHotelBooking[];
  flights: MasterFlightBooking[];
  trains: MasterTrainBooking[];
  transports: MasterTransportBooking[];
  checklist: string;
}

function pick(
  record: Record<string, string>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const val = record[key]?.trim();
    if (val) return val;
  }
  return "";
}

/** Single deduplicated inventory from every uploaded document. */
export function buildMasterBookingInventory(
  documents: DocumentForAI[]
): MasterBookingInventory {
  const hotels: MasterHotelBooking[] = [];
  const flights: MasterFlightBooking[] = [];
  const trains: MasterTrainBooking[] = [];
  const transports: MasterTransportBooking[] = [];
  const passengerNames = new Set<string>();
  const seenHotel = new Set<string>();
  const seenFlight = new Set<string>();
  const seenTrain = new Set<string>();
  const seenTransport = new Set<string>();

  for (const doc of documents) {
    for (const h of doc.facts.hotels) {
      const hotel = pick(h, "hotel", "Hotel");
      const city = pick(h, "city", "City");
      const checkIn = pick(h, "checkIn", "Check-in", "Checkin");
      const checkOut = pick(h, "checkOut", "Check-out", "Check out");
      const confirmation = pick(
        h,
        "hotelConfirmation",
        "Hotel Confirmation",
        "confirmation"
      );
      const voucherNumber = pick(h, "voucherNumber", "Voucher Number");
      const guestName = pick(h, "guestName", "Guest Name");

      const dedupeKey = [
        hotel.toLowerCase(),
        city.toLowerCase(),
        checkIn,
        checkOut,
        confirmation || voucherNumber,
        pick(h, "voucherIndex"),
      ].join("|");

      if (!hotel && !city && !checkIn) continue;
      if (seenHotel.has(dedupeKey)) continue;
      seenHotel.add(dedupeKey);

      hotels.push({
        id: `H${hotels.length + 1}`,
        sourceDocument: doc.originalName,
        sourceDocumentId: doc.id,
        hotel,
        city,
        guestName,
        checkIn,
        checkOut,
        confirmation,
        voucherNumber,
        roomType: pick(h, "roomType", "Type of Room"),
        meals: pick(h, "meals", "Meal includes"),
        nights: pick(h, "nights", "Nights"),
      });

      if (guestName) passengerNames.add(guestName);
    }

    let docFlights = doc.facts.flights;
    const flightFallback = extractAllFlights(doc.text);
    if (flightFallback.length > docFlights.length) {
      docFlights = flightFallback;
    }

    for (const f of docFlights) {
      const from = pick(f, "from", "From", "origin");
      const to = pick(f, "to", "To", "destination");
      const flightNumber = pick(f, "flightNumber", "Flight", "flight");
      const gate = pick(f, "gate", "Gate");
      const seat = pick(f, "seat", "Seat");
      const date = pick(f, "date", "Date");
      const pnr = pick(f, "pnr", "PNR");

      if (!from && !to && !flightNumber && !gate && !date && !pnr) continue;

      const dedupeKey = [from, to, date, flightNumber, pnr, doc.id].join("|");
      if (seenFlight.has(dedupeKey)) continue;
      seenFlight.add(dedupeKey);

      flights.push({
        id: `F${flights.length + 1}`,
        sourceDocument: doc.originalName,
        sourceDocumentId: doc.id,
        from,
        to,
        flightNumber,
        date,
        departureTime: pick(f, "departureTime", "Boarding Time"),
        gate,
        seat,
        carrier: pick(f, "carrier", "carrier"),
        pnr,
      });
    }

    for (const t of doc.facts.trains ?? []) {
      const from = pick(t, "from", "From");
      const to = pick(t, "to", "To");
      const trainNumber = pick(t, "trainNumber", "Train");
      const date = pick(t, "date", "Date of Journey", "Date");
      const pnr = pick(t, "pnr", "PNR");

      if (!from && !to && !trainNumber) continue;
      if (!isValidPlaceName(from) && !isValidPlaceName(to)) continue;

      const dedupeKey = [from, to, date, trainNumber, pnr].join("|");
      if (seenTrain.has(dedupeKey)) continue;
      seenTrain.add(dedupeKey);

      trains.push({
        id: `T${trains.length + 1}`,
        sourceDocument: doc.originalName,
        sourceDocumentId: doc.id,
        from,
        to,
        trainNumber,
        date,
        departureTime: pick(t, "departureTime", "Departure"),
        pnr,
        travelClass: pick(t, "travelClass", "Class"),
      });
    }

    for (const tr of doc.facts.transports ?? []) {
      const type = pick(tr, "type", "documentRole");
      const from = pick(tr, "from", "pickup", "Pickup");
      const to = pick(tr, "to", "dropoff", "Dropoff");
      const date = pick(tr, "date", "Date");

      if (!from && !to && !date) continue;
      if (!isValidPlaceName(from) && !isValidPlaceName(to)) continue;

      const dedupeKey = [type, from, to, date].join("|");
      if (seenTransport.has(dedupeKey)) continue;
      seenTransport.add(dedupeKey);

      transports.push({
        id: `B${transports.length + 1}`,
        sourceDocument: doc.originalName,
        sourceDocumentId: doc.id,
        type: type || "transport",
        from,
        to,
        date,
        time: pick(tr, "time", "Time"),
        operator: pick(tr, "operator", "Operator"),
      });
    }

    for (const name of doc.facts.passengerNames) {
      if (name.trim()) passengerNames.add(name.trim());
    }
    for (const f of docFlights) {
      const pax = pick(f, "passengerName");
      if (pax) passengerNames.add(pax);
    }
  }

  const checklistParts: string[] = [];
  for (const h of hotels) {
    checklistParts.push(
      `${h.id}: HOTEL "${h.hotel || "Hotel"}" in ${h.city || "TBD"} — check-in ${h.checkIn || "TBD"}, check-out ${h.checkOut || "TBD"} (${h.sourceDocument})`
    );
  }
  for (const f of flights) {
    checklistParts.push(
      `${f.id}: FLIGHT ${f.from || "?"} → ${f.to || "?"} on ${f.date || "TBD"}${f.flightNumber ? ` ${f.flightNumber}` : ""} (${f.sourceDocument})`
    );
  }
  for (const t of trains) {
    checklistParts.push(
      `${t.id}: TRAIN ${t.from || "?"} → ${t.to || "?"} on ${t.date || "TBD"}${t.trainNumber ? ` #${t.trainNumber}` : ""} (${t.sourceDocument})`
    );
  }
  for (const b of transports) {
    checklistParts.push(
      `${b.id}: ${b.type.toUpperCase()} ${b.from || "?"} → ${b.to || "?"} on ${b.date || "TBD"} (${b.sourceDocument})`
    );
  }

  const checklist =
    checklistParts.length > 0
      ? `MANDATORY — include every item from all ${documents.length} document(s):\n${checklistParts.map((l) => `- ${l}`).join("\n")}`
      : "Use all facts from every document below.";

  return {
    documentCount: documents.length,
    hotelCount: hotels.length,
    flightCount: flights.length,
    trainCount: trains.length,
    transportCount: transports.length,
    passengerNames: [...passengerNames],
    hotels,
    flights,
    trains,
    transports,
    checklist,
  };
}

export function formatMasterInventoryForPrompt(
  inventory: MasterBookingInventory
): string {
  const summary = `${inventory.documentCount} docs | ${inventory.hotelCount} hotels | ${inventory.flightCount} flights | ${inventory.trainCount} trains | ${inventory.transportCount} transport`;

  const hotelsCompact = inventory.hotels.map((h) => ({
    id: h.id,
    source: h.sourceDocument,
    hotel: h.hotel,
    city: h.city,
    checkIn: h.checkIn,
    checkOut: h.checkOut,
    room: h.roomType,
    meals: h.meals,
    nights: h.nights,
    conf: h.confirmation || h.voucherNumber || null,
    guest: h.guestName,
  }));

  const flightsCompact = inventory.flights.map((f) => ({
    id: f.id,
    source: f.sourceDocument,
    from: f.from,
    to: f.to,
    flight: f.flightNumber,
    date: f.date,
    time: f.departureTime,
    gate: f.gate,
    seat: f.seat,
    carrier: f.carrier,
    pnr: f.pnr,
  }));

  const trainsCompact = inventory.trains.map((t) => ({
    id: t.id,
    source: t.sourceDocument,
    from: t.from,
    to: t.to,
    train: t.trainNumber,
    date: t.date,
    time: t.departureTime,
    class: t.travelClass,
    pnr: t.pnr,
  }));

  const transportsCompact = inventory.transports.map((tr) => ({
    id: tr.id,
    source: tr.sourceDocument,
    type: tr.type,
    from: tr.from,
    to: tr.to,
    date: tr.date,
    time: tr.time,
    operator: tr.operator,
  }));

  return `=== MASTER BOOKING INVENTORY (${summary}) ===
${inventory.checklist}

Passengers: ${inventory.passengerNames.join(", ") || "see documents"}

${hotelsCompact.length ? `Hotels:\n${JSON.stringify(hotelsCompact)}\n` : ""}${flightsCompact.length ? `Flights:\n${JSON.stringify(flightsCompact)}\n` : ""}${trainsCompact.length ? `Trains:\n${JSON.stringify(trainsCompact)}\n` : ""}${transportsCompact.length ? `Transport:\n${JSON.stringify(transportsCompact)}` : ""}`.trim();
}

export function collectMergedFacts(
  documents: DocumentForAI[]
): TravelFacts {
  const hotels: TravelFacts["hotels"] = [];
  const flights: TravelFacts["flights"] = [];
  const trains: TravelFacts["trains"] = [];
  const transports: TravelFacts["transports"] = [];
  const dates: string[] = [];
  const bookingRefs: string[] = [];
  const passengerNames: string[] = [];
  const locations: string[] = [];
  const meals: string[] = [];
  const notes: string[] = [];

  for (const doc of documents) {
    hotels.push(...doc.facts.hotels);
    flights.push(...doc.facts.flights);
    trains.push(...(doc.facts.trains ?? []));
    transports.push(...(doc.facts.transports ?? []));
    dates.push(...doc.facts.dates);
    bookingRefs.push(...doc.facts.bookingRefs);
    passengerNames.push(...doc.facts.passengerNames);
    locations.push(...doc.facts.locations);
    meals.push(...doc.facts.meals);
    notes.push(...doc.facts.notes);
  }

  const typeCount = [hotels, flights, trains, transports].filter(
    (a) => a.length > 0
  ).length;

  return {
    documentType:
      typeCount > 1 ? "multi" : flights.length ? "flight" : hotels.length ? "hotel" : trains.length ? "train" : "other",
    documentKind: typeCount > 1 ? "mixed" : "travel_other",
    detectedKinds: [],
    passengerNames: [...new Set(passengerNames)],
    flights,
    hotels,
    trains,
    transports,
    dates: [...new Set(dates)],
    times: [],
    locations: [...new Set(locations)],
    bookingRefs: [...new Set(bookingRefs)],
    meals: [...new Set(meals)],
    notes: [...new Set(notes)],
    voucherCount: hotels.length,
  };
}
