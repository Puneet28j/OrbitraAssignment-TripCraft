export const ROUTES = Object.freeze({
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  UPLOAD: '/upload',
  ITINERARY_DETAIL: '/itinerary/:id',
  ITINERARY_DETAIL_FN: (id: string) => `/itinerary/${id}`,
  HISTORY: '/history',
  SHARED_ITINERARY: '/shared/:token',
  SHARED_ITINERARY_FN: (token: string) => `/shared/${token}`,
  NOT_FOUND: '*',
});

export const ACTIVITY_TYPES = Object.freeze({
  FLIGHT: 'flight',
  HOTEL: 'hotel',
  TRANSPORT: 'transport',
  SIGHTSEEING: 'sightseeing',
  DINING: 'dining',
  ACTIVITY: 'activity',
  OTHER: 'other',
});

export const FILE_CONSTRAINTS = Object.freeze({
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILES: 10,
  ACCEPTED_TYPES: {
    'application/pdf': ['.pdf'],
    'image/jpeg': ['.jpeg', '.jpg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
  },
});
