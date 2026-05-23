import { axiosInstance } from '../api/axiosInstance';
import { API_ENDPOINTS } from '../api/endpoints';
import type { ApiSuccessResponse, PaginationMeta } from '../types/api';
import type { Itinerary } from '../types/itinerary';

export interface ItineraryListParams {
  page?: number;
  limit?: number;
  sort?: 'newest' | 'oldest';
}

export async function fetchItineraries(params: ItineraryListParams = {}) {
  const response = await axiosInstance.get<ApiSuccessResponse<Itinerary[]>>(
    API_ENDPOINTS.ITINERARY.BASE,
    { params }
  );
  return {
    itineraries: response.data.data,
    meta: response.data.meta as PaginationMeta,
  };
}

export async function fetchItineraryById(id: string) {
  const response = await axiosInstance.get<ApiSuccessResponse<Itinerary>>(
    API_ENDPOINTS.ITINERARY.BY_ID(id)
  );
  return response.data.data;
}

export interface SharedItineraryPayload {
  itinerary: Itinerary;
  ownerName: string;
}

export async function fetchSharedItinerary(token: string) {
  const response = await axiosInstance.get<ApiSuccessResponse<SharedItineraryPayload>>(
    API_ENDPOINTS.ITINERARY.SHARED(token)
  );
  return response.data.data;
}

export async function deleteItinerary(id: string) {
  await axiosInstance.delete(API_ENDPOINTS.ITINERARY.BY_ID(id));
}

export async function generateItinerary(documentIds: string[]) {
  const response = await axiosInstance.post<ApiSuccessResponse<Itinerary>>(
    API_ENDPOINTS.ITINERARY.GENERATE,
    { documentIds }
  );
  return response.data.data;
}

export interface ShareItineraryResult {
  shareToken: string;
  shareUrl?: string;
}

export async function enableItineraryShare(id: string) {
  const response = await axiosInstance.post<ApiSuccessResponse<ShareItineraryResult>>(
    API_ENDPOINTS.ITINERARY.SHARE(id)
  );
  return response.data.data;
}

export async function disableItineraryShare(id: string) {
  await axiosInstance.delete(API_ENDPOINTS.ITINERARY.SHARE(id));
}

export async function fetchDocumentsCount() {
  const response = await axiosInstance.get<ApiSuccessResponse<unknown[]>>(
    API_ENDPOINTS.UPLOAD.BASE,
    { params: { page: 1, limit: 1 } }
  );
  return response.data.meta?.total ?? 0;
}
