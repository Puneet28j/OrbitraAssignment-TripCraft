import { useQuery } from '@tanstack/react-query';
import { fetchItineraryById } from '../../services/itineraryService';
import { queryKeys } from './queryKeys';

export function useItineraryQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.itineraries.detail(id ?? ''),
    queryFn: () => fetchItineraryById(id!),
    enabled: !!id,
  });
}
