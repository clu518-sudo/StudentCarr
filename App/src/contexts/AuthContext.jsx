import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../lib/apiClient";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const normalizeUser = (rawUser) => ({
    ...rawUser,
    authProvider: rawUser?.authProvider || "password",
    name: rawUser?.fullName || rawUser?.email || "",
  });

  const applyAuthState = (nextUser, nextToken) => {
    setUser(normalizeUser(nextUser));
    setAccessToken(nextToken);
    setIsAuthenticated(Boolean(nextUser && nextToken));
  };

  const clearAuthState = () => {
    setUser(null);
    setAccessToken(null);
    setIsAuthenticated(false);
  };

  const refreshSession = async () => {
    try {
      const response = await authApi.refresh();
      const nextUser = normalizeUser(response.data.user);
      applyAuthState(nextUser, response.data.accessToken);
      return { success: true, user: nextUser, accessToken: response.data.accessToken };
    } catch (error) {
      clearAuthState();
      return { success: false, error: error.message };
    }
  };

  const fetchMe = async (token) => {
    try {
      const response = await authApi.me(token || accessToken);
      const nextUser = normalizeUser(response.data.user);
      setUser(nextUser);
      setIsAuthenticated(true);
      return { success: true, user: nextUser };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    let mounted = true;

    const bootstrapAuth = async () => {
      const refreshed = await refreshSession();
      if (!mounted) {
        return;
      }

      if (refreshed.success) {
        await fetchMe(refreshed.accessToken);
      }
      setInitializing(false);
    };

    bootstrapAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await authApi.login({ email, password });
      const nextUser = normalizeUser(response.data.user);

      applyAuthState(nextUser, response.data.accessToken);
      return { success: true };
    } catch (error) {
      // The status is what lets the login form tell a rejected credential
      // (401) apart from a validation or transport problem.
      return {
        success: false,
        error: error.message,
        status: error.status,
        isNetworkError: Boolean(error.isNetworkError),
      };
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const response = await authApi.googleLoginStart();
      const authUrl = response?.data?.authUrl;
      if (!authUrl) {
        throw new Error("Google login URL was not returned.");
      }
      window.location.assign(authUrl);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message || "Google login failed" };
    } finally {
      setLoading(false);
    }
  };

  const signup = async ({ email, password, fullName }) => {
    setLoading(true);
    try {
      const response = await authApi.signup({ email, password, fullName });
      const nextUser = normalizeUser(response.data.user);
      applyAuthState(nextUser, response.data.accessToken);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Clear local auth state even if API call fails.
    }
    clearAuthState();
  };

  const value = useMemo(
    () => ({
      isAuthenticated,
      user,
      loading,
      initializing,
      accessToken,
      login,
      loginWithGoogle,
      signup,
      logout,
      refreshSession,
      fetchMe,
    }),
    [isAuthenticated, user, loading, initializing, accessToken],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
