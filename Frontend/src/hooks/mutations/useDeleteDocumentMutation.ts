import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadService } from '../../services/uploadService';
import { getErrorMessage } from '../../lib/apiError';
import { queryKeys } from '../queries/queryKeys';

export function useDeleteDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => uploadService.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.unassigned });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    onError: (error) => {
      console.error(getErrorMessage(error, 'Failed to delete document'));
    },
  });
}
