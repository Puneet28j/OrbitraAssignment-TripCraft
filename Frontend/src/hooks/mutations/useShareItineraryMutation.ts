import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  disableItineraryShare,
  enableItineraryShare,
} from '../../services/itineraryService';
import { getErrorMessage } from '../../lib/apiError';
import { queryKeys } from '../queries/queryKeys';

interface ShareMutationVars {
  itineraryId: string;
  enable: boolean;
}

export function useShareItineraryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itineraryId, enable }: ShareMutationVars) => {
      if (enable) {
        return enableItineraryShare(itineraryId);
      }
      await disableItineraryShare(itineraryId);
      return { shareToken: null as string | null };
    },
    onSuccess: (_data, { itineraryId, enable }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.itineraries.detail(itineraryId),
      });
      toast.success(enable ? 'Public link enabled' : 'Public link disabled');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to update sharing settings'));
    },
  });
}
