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

  const applyAuthState = (nextUser, nextToken) => {
    setUser(nextUser);
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
      const nextUser = {
        ...response.data.user,
        name: response.data.user.fullName || response.data.user.email,
      };
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
      const nextUser = {
        ...response.data.user,
        name: response.data.user.fullName || response.data.user.email,
      };
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
      const nextUser = {
        ...response.data.user,
        name: response.data.user.fullName || response.data.user.email,
      };

      applyAuthState(nextUser, response.data.accessToken);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const signup = async ({ email, password, fullName }) => {
    setLoading(true);
    try {
      const response = await authApi.signup({ email, password, fullName });
      const nextUser = {
        ...response.data.user,
        name: response.data.user.fullName || response.data.user.email,
      };
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
