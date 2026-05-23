import mongoose, { type Document, type Model, type Types } from "mongoose";

export const ACTIVITY_TYPES = [
  "flight",
  "hotel",
  "transport",
  "sightseeing",
  "dining",
  "activity",
  "other",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface IActivity {
  time?: string | null;
  type?: ActivityType;
  title: string;
  description?: string;
  location?: string | null;
  bookingRef?: string | null;
  duration?: string | null;
}

export interface IDay {
  dayNumber: number;
  date?: string | null;
  title: string;
  activities: IActivity[];
}

export interface IItinerary {
  userId: Types.ObjectId;
  documentIds: Types.ObjectId[];
  title: string;
  destination: string;
  startDate?: Date | null;
  endDate?: Date | null;
  summary?: string;
  days: IDay[];
  shareToken?: string | null;
  isPublic: boolean;
  sharedAt?: Date | null;
  isDeleted: boolean;
}

export interface IItineraryDocument extends IItinerary, Document {
  dayCount?: number;
}

export interface IItineraryModel extends Model<IItineraryDocument> {}

const activitySchema = new mongoose.Schema<IActivity>(
  {
    time: { type: String, default: null },
    type: {
      type: String,
      enum: {
        values: ACTIVITY_TYPES,
        message: `Activity type must be one of: ${ACTIVITY_TYPES.join(", ")}`,
      },
      default: "other",
    },
    title: {
      type: String,
      required: [true, "Activity title is required"],
      trim: true,
    },
    description: { type: String, default: "", trim: true },
    location: { type: String, default: null, trim: true },
    bookingRef: { type: String, default: null, trim: true },
    duration: { type: String, default: null, trim: true },
  },
  { _id: true }
);

const daySchema = new mongoose.Schema<IDay>(
  {
    dayNumber: {
      type: Number,
      required: [true, "Day number is required"],
      min: 1,
    },
    date: { type: String, default: null },
    title: {
      type: String,
      required: [true, "Day title is required"],
      trim: true,
    },
    activities: { type: [activitySchema], default: [] },
  },
  { _id: true }
);

const itinerarySchema = new mongoose.Schema<IItineraryDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    documentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
      },
    ],
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title must be at most 200 characters"],
    },
    destination: {
      type: String,
      required: [true, "Destination is required"],
      trim: true,
      maxlength: [150, "Destination must be at most 150 characters"],
    },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    summary: { type: String, default: "", trim: true },
    days: { type: [daySchema], default: [] },
    shareToken: { type: String },
    isPublic: { type: Boolean, default: false },
    sharedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

itinerarySchema.index({ userId: 1, createdAt: -1 });
itinerarySchema.index({ shareToken: 1 }, { unique: true, sparse: true });

itinerarySchema.virtual("dayCount").get(function (this: IItineraryDocument) {
  return this.days?.length ?? 0;
});

const Itinerary = mongoose.model<IItineraryDocument, IItineraryModel>(
  "Itinerary",
  itinerarySchema
);

export default Itinerary;
