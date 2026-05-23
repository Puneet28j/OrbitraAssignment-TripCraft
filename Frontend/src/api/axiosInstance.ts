/**
 * HTTP client (Axios). Used only by `services/*` — not by pages or components.
 * React Query hooks in `hooks/` call services; this file handles auth headers + refresh.
 */
import axios from "axios";
import { API_ENDPOINTS } from "./endpoints";
import { notifyAuthRedirect } from "../lib/authEvents";

// Base URL configuration using Vite environment variables
const baseURL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";

export const axiosInstance = axios.create({
  baseURL,
  withCredentials: true, // Support httpOnly cookies for sessions
  headers: {
    "Content-Type": "application/json",
  },
});

let isRefreshing = false;

interface FailedQueueItem {
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
}

let failedQueue: FailedQueueItem[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Global callbacks to sync with AuthContext state
let onTokenRefreshedCallback: ((token: string) => void) | null = null;
let onLogoutCallback: (() => void) | null = null;

export const setTokenRefreshedCallback = (
  cb: ((token: string) => void) | null
) => {
  onTokenRefreshedCallback = cb;
};

export const setLogoutCallback = (cb: (() => void) | null) => {
  onLogoutCallback = cb;
};

let currentToken: string | null = null;

/**
 * Update the default Authorization header.
 * @param {string | null} token - The access token or null to clear it
 */
export const setAccessTokenHeader = (token: string | null) => {
  currentToken = token;
  if (token) {
    axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete axiosInstance.defaults.headers.common["Authorization"];
  }
};

// Request Interceptor: Safety net to ensure Authorization header is always attached
axiosInstance.interceptors.request.use(
  (config) => {
    // If currentToken exists but Authorization header is missing, attach it.
    if (currentToken && config.headers) {
      const headers = config.headers as any;
      const existing =
        typeof headers.get === "function"
          ? headers.get("Authorization")
          : headers.Authorization || headers["authorization"];

      if (!existing) {
        if (typeof headers.set === "function") {
          headers.set("Authorization", `Bearer ${currentToken}`);
        } else {
          headers.Authorization = `Bearer ${currentToken}`;
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle token refresh on 401 errors
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh on 401, if not already retrying, and not an auth login/register endpoint
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes(API_ENDPOINTS.AUTH.LOGIN) &&
      !originalRequest.url?.includes(API_ENDPOINTS.AUTH.REGISTER) &&
      !originalRequest.url?.includes(API_ENDPOINTS.AUTH.REFRESH)
    ) {
      if (isRefreshing) {
        // Queue this request to retry once refresh completes
        return new Promise<string | null>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers["Authorization"] = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt token refresh via refresh endpoint
        const response = await axios.post(
          `${baseURL}${API_ENDPOINTS.AUTH.REFRESH}`,
          {},
          { withCredentials: true }
        );

        const { accessToken } = response.data.data;

        // Set access token header and execute callback for Context sync
        setAccessTokenHeader(accessToken);
        if (onTokenRefreshedCallback) {
          onTokenRefreshedCallback(accessToken);
        }

        processQueue(null, accessToken);
        isRefreshing = false;

        // Retry the original request
        originalRequest.headers["Authorization"] = `Bearer ${accessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

        // Refresh failed, execute logout handler
        if (onLogoutCallback) {
          onLogoutCallback();
        }

        notifyAuthRedirect("/login");

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
