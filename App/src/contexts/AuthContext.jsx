import React, { createContext, useContext, useMemo, useState } from "react";
import { visitorUser } from "../data/visitorDemoData";

const AuthContext = createContext(null);
const VISITOR_SESSION_KEY = "studentcarr-visitor-session";

const hasVisitorSession = () => {
  try {
    return window.sessionStorage.getItem(VISITOR_SESSION_KEY) === "active";
  } catch {
    return false;
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => hasVisitorSession() ? visitorUser : null);

  const loginAsVisitor = () => {
    window.sessionStorage.setItem(VISITOR_SESSION_KEY, "active");
    setUser(visitorUser);
    return { success: true };
  };

  const logout = () => {
    window.sessionStorage.removeItem(VISITOR_SESSION_KEY);
    setUser(null);
  };

  const value = useMemo(() => ({
    isAuthenticated: Boolean(user),
    isVisitor: user?.authProvider === "visitor",
    user,
    accessToken: null,
    loading: false,
    initializing: false,
    loginAsVisitor,
    logout,
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
