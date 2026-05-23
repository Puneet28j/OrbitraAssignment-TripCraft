import { createContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { authService } from "../services/authService";
import {
  setTokenRefreshedCallback,
  setLogoutCallback,
  setAccessTokenHeader,
} from "../api/axiosInstance";

export interface UserProfile {
  _id: string;
  name: string;
  email: string;
}

export interface AuthContextType {
  user: UserProfile | null;
  accessToken: string | null;
  /** True only during initial session rehydration on app load */
  isInitializing: boolean;
  /** @deprecated Use isInitializing — kept for gradual migration */
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const handleTokenRefreshed = useCallback((token: string) => {
    setAccessToken(token);
  }, []);

  const handleLogoutEvent = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setAccessTokenHeader(null);
  }, []);

  useEffect(() => {
    setTokenRefreshedCallback(handleTokenRefreshed);
    setLogoutCallback(handleLogoutEvent);

    return () => {
      setTokenRefreshedCallback(null);
      setLogoutCallback(null);
    };
  }, [handleTokenRefreshed, handleLogoutEvent]);

  useEffect(() => {
    setAccessTokenHeader(accessToken);
  }, [accessToken]);

  useEffect(() => {
    const rehydrateSession = async () => {
      try {
        const { user: refreshedUser, accessToken: refreshedToken } =
          await authService.refresh();
        setUser(refreshedUser);
        setAccessToken(refreshedToken);
      } catch {
        // No active session — expected for logged-out users
      } finally {
        setIsInitializing(false);
      }
    };
    rehydrateSession();
  }, []);

  const login = async (email: string, password: string) => {
    const { user: loggedInUser, accessToken: token } =
      await authService.login(email, password);
    setUser(loggedInUser);
    setAccessToken(token);
  };

  const register = async (name: string, email: string, password: string) => {
    const { user: registeredUser, accessToken: token } =
      await authService.register(name, email, password);
    setUser(registeredUser);
    setAccessToken(token);
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      handleLogoutEvent();
    }
  };

  const value: AuthContextType = {
    user,
    accessToken,
    isInitializing,
    isLoading: isInitializing,
    isAuthenticated: !!accessToken,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
