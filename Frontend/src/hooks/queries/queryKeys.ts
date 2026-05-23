export const queryKeys = {
  itineraries: {
    all: ['itineraries'] as const,
    list: (params: Record<string, unknown>) => ['itineraries', 'list', params] as const,
    detail: (id: string) => ['itineraries', 'detail', id] as const,
    shared: (token: string) => ['itineraries', 'shared', token] as const,
  },
  dashboard: ['dashboard'] as const,
  documents: {
    all: ['documents'] as const,
    count: ['documents', 'count'] as const,
    unassigned: ['documents', 'unassigned'] as const,
    status: (id: string) => ['documents', 'status', id] as const,
  },
};
