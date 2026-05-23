import type { TripDocument } from './document';

export type ActivityType =
  | 'flight'
  | 'hotel'
  | 'transport'
  | 'sightseeing'
  | 'dining'
  | 'activity'
  | 'other';

export interface Activity {
  _id?: string;
  time?: string | null;
  type: ActivityType;
  title: string;
  description?: string;
  location?: string | null;
  bookingRef?: string | null;
  duration?: string | null;
}

export interface ItineraryDay {
  _id?: string;
  dayNumber: number;
  date?: string | null;
  title: string;
  activities: Activity[];
}

export interface Itinerary {
  _id: string;
  userId?: string;
  title: string;
  destination: string;
  startDate?: string | null;
  endDate?: string | null;
  summary?: string;
  days: ItineraryDay[];
  documentIds?: string[];
  documents?: TripDocument[];
  shareToken?: string | null;
  isPublic?: boolean;
  sharedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
