import { useQuery } from '@tanstack/react-query';
import { fetchSharedItinerary, type SharedItineraryPayload } from '../../services/itineraryService';
import { queryKeys } from './queryKeys';

export function useSharedItineraryQuery(token: string | undefined) {
  return useQuery<SharedItineraryPayload>({
    queryKey: queryKeys.itineraries.shared(token ?? ''),
    queryFn: () => fetchSharedItinerary(token!),
    enabled: !!token,
  });
}
