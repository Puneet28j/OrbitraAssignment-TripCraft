import { useQuery } from '@tanstack/react-query';
import { uploadService } from '../../services/uploadService';
import { queryKeys } from './queryKeys';

export function useUnassignedDocumentsQuery() {
  return useQuery({
    queryKey: queryKeys.documents.unassigned,
    queryFn: () => uploadService.getUnassignedDocuments(),
    staleTime: 30_000,
  });
}
