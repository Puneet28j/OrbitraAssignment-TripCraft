import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { generateItinerary } from '../../services/itineraryService';
import { getErrorMessage } from '../../lib/apiError';
import { queryKeys } from '../queries/queryKeys';

export function useGenerateItineraryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentIds: string[]) => generateItinerary(documentIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itineraries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.unassigned });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      toast.success('Itinerary generated successfully');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to generate itinerary'));
    },
  });
}
