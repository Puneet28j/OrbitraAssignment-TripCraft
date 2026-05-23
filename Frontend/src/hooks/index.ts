/**
 * React Query hooks — use these in components/pages.
 * HTTP calls live in `services/` (axios). Do not import axiosInstance in UI code.
 */

export { queryKeys } from './queries/queryKeys';

export { useDashboardQuery } from './queries/useDashboardQuery';
export { useItineraryHistoryQuery } from './queries/useItineraryHistoryQuery';
export { useItineraryQuery } from './queries/useItineraryQuery';
export { useSharedItineraryQuery } from './queries/useSharedItineraryQuery';
export { useDocumentStatusQuery } from './queries/useDocumentStatusQuery';

export { useDeleteItineraryMutation } from './mutations/useDeleteItineraryMutation';
export { useGenerateItineraryMutation } from './mutations/useGenerateItineraryMutation';
export { useShareItineraryMutation } from './mutations/useShareItineraryMutation';
export { useDeleteDocumentMutation } from './mutations/useDeleteDocumentMutation';

export { useAuth } from './useAuth';
export { default as useUpload } from './useUpload';
