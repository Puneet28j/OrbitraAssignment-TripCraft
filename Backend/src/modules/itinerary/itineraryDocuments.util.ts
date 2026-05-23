import type { Types } from "mongoose";
import Document from "../../models/Document.js";
import { getSignedViewUrl } from "../upload/cloudinary.service.js";
import type { FileType } from "../../models/Document.js";

const DOCUMENT_FIELDS =
  "originalName fileName fileType mimeType status thumbnailUrl fileSize createdAt publicId resourceType";

export interface ItineraryDocumentSummary {
  _id: Types.ObjectId;
  originalName: string;
  fileName: string;
  fileType: FileType;
  mimeType: string;
  status: string;
  thumbnailUrl?: string | null;
  fileSize: number;
  createdAt?: Date;
  publicId: string;
  resourceType: "raw" | "image";
  viewUrl: string;
}

function enrichDocument(
  doc: Omit<ItineraryDocumentSummary, "viewUrl">
): ItineraryDocumentSummary {
  return {
    ...doc,
    viewUrl: getSignedViewUrl(doc.publicId, doc.resourceType, doc.fileType),
  };
}

type WithDocumentIds = {
  documentIds?: Types.ObjectId[];
  toObject?: () => Record<string, unknown>;
};

function toPlain<T extends WithDocumentIds>(itinerary: T): Record<string, unknown> {
  if (typeof itinerary.toObject === "function") {
    return itinerary.toObject() as Record<string, unknown>;
  }
  return { ...itinerary } as Record<string, unknown>;
}

export async function attachDocumentsToItineraries<T extends WithDocumentIds>(
  itineraries: T[]
): Promise<Array<Record<string, unknown> & { documents: ItineraryDocumentSummary[] }>> {
  const idSet = new Set<string>();
  for (const itin of itineraries) {
    for (const id of itin.documentIds ?? []) {
      idSet.add(String(id));
    }
  }

  if (idSet.size === 0) {
    return itineraries.map((itin) => ({
      ...toPlain(itin),
      documents: [],
    }));
  }

  const docs = await Document.find(
    { _id: { $in: [...idSet] } },
    DOCUMENT_FIELDS
  ).lean();

  const docMap = new Map(
    docs.map((doc) => {
      const row = doc as Omit<ItineraryDocumentSummary, "viewUrl">;
      return [String(doc._id), enrichDocument(row)];
    })
  );

  return itineraries.map((itin) => {
    const plain = toPlain(itin);
    const documents = (plain.documentIds as Types.ObjectId[] | undefined ?? [])
      .map((id) => docMap.get(String(id)))
      .filter((doc): doc is ItineraryDocumentSummary => Boolean(doc));

    return { ...plain, documents };
  });
}

export async function attachDocumentsToItinerary<T extends WithDocumentIds>(
  itinerary: T
): Promise<Record<string, unknown> & { documents: ItineraryDocumentSummary[] }> {
  const [withDocs] = await attachDocumentsToItineraries([itinerary]);
  return withDocs;
}
