export const API_ENDPOINTS = Object.freeze({
  AUTH: {
    REGISTER: '/auth/register',
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
  },
  UPLOAD: {
    SIGN: '/upload/sign',
    BASE: '/upload',
    UNASSIGNED: '/upload/unassigned',
    BATCH: '/upload/batch',
    BY_ID: (id: string) => `/upload/${id}`,
    STATUS: (id: string) => `/upload/${id}/status`,
    VIEW_URL: (id: string) => `/upload/${id}/view-url`,
    CONTENT: (id: string) => `/upload/${id}/content`,
  },
  ITINERARY: {
    BASE: '/itinerary',
    GENERATE: '/itinerary/generate',
    BY_ID: (id: string) => `/itinerary/${id}`,
    SHARE: (id: string) => `/itinerary/${id}/share`,
    SHARED: (token: string) => `/itinerary/shared/${token}`,
  },
});
