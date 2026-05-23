import { useQuery } from '@tanstack/react-query';
import { uploadService } from '../../services/uploadService';
import { queryKeys } from './queryKeys';
import type { DocumentStatus } from '../../types/document';

const TERMINAL_STATUSES: DocumentStatus[] = ['ready', 'failed'];

export function useDocumentStatusQuery(documentId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.documents.status(documentId ?? ''),
    queryFn: () => uploadService.getDocumentStatus(documentId!),
    enabled: !!documentId && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || TERMINAL_STATUSES.includes(status)) return false;
      return 2500;
    },
  });
}
