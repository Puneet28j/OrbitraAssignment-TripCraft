import { useQuery } from '@tanstack/react-query';
import { fetchItineraries } from '../../services/itineraryService';
import { queryKeys } from './queryKeys';

interface UseItineraryHistoryQueryOptions {
  page?: number;
  limit?: number;
  sort?: 'newest' | 'oldest';
}

export function useItineraryHistoryQuery(options: UseItineraryHistoryQueryOptions = {}) {
  const { page = 1, limit = 6, sort = 'newest' } = options;

  return useQuery({
    queryKey: queryKeys.itineraries.list({ page, limit, sort }),
    queryFn: () => fetchItineraries({ page, limit, sort }),
  });
}
