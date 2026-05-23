import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { deleteItinerary } from '../../services/itineraryService';
import { getErrorMessage } from '../../lib/apiError';
import { queryKeys } from '../queries/queryKeys';

export function useDeleteItineraryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteItinerary(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itineraries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      toast.success('Itinerary deleted');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to delete itinerary'));
    },
  });
}
