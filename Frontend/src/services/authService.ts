import { axiosInstance, setAccessTokenHeader } from '../api/axiosInstance';
import { API_ENDPOINTS } from '../api/endpoints';

/**
 * Service to handle all Authentication API calls.
 */
export const authService = {
  /**
   * Register a new user account.
   */
  async register(name: string, email: string, password: string) {
    const response = await axiosInstance.post(API_ENDPOINTS.AUTH.REGISTER, {
      name,
      email,
      password,
    });
    const { user, accessToken } = response.data.data;
    setAccessTokenHeader(accessToken);
    return { user, accessToken };
  },

  /**
   * Log in an existing user.
   */
  async login(email: string, password: string) {
    const response = await axiosInstance.post(API_ENDPOINTS.AUTH.LOGIN, {
      email,
      password,
    });
    const { user, accessToken } = response.data.data;
    setAccessTokenHeader(accessToken);
    return { user, accessToken };
  },

  /**
   * Log out the current user and clear token header.
   */
  async logout() {
    await axiosInstance.post(API_ENDPOINTS.AUTH.LOGOUT);
    setAccessTokenHeader(null);
  },

  /**
   * Refresh the user's access token using httpOnly cookie.
   */
  async refresh() {
    const response = await axiosInstance.post(API_ENDPOINTS.AUTH.REFRESH);
    const { user, accessToken } = response.data.data;
    setAccessTokenHeader(accessToken);
    return { user, accessToken };
  },

  /**
   * Get currently logged-in user profile.
   */
  async getMe() {
    const response = await axiosInstance.get(API_ENDPOINTS.AUTH.ME);
    return response.data.data;
  },
};
