import { useQuery } from '@tanstack/react-query';
import { fetchDocumentsCount, fetchItineraries } from '../../services/itineraryService';
import { queryKeys } from './queryKeys';

export function useDashboardQuery() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: async () => {
      const [itineraryResult, documentsCount] = await Promise.all([
        fetchItineraries({ page: 1, limit: 3 }),
        fetchDocumentsCount(),
      ]);

      return {
        recentItineraries: itineraryResult.itineraries,
        itinerariesCount: itineraryResult.meta?.total ?? itineraryResult.itineraries.length,
        documentsCount,
      };
    },
  });
}
