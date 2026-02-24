import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { forgotPassword as forgotPasswordService, login as loginService, logout as logoutService } from "../services/auth.js";
import { getStoredAuthToken } from "../services/authToken.js";

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [lastEmail, setLastEmail] = useState("");

  useEffect(() => {
    const token = getStoredAuthToken();
    if (token) {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await loginService(email, password);
    setIsAuthenticated(true);
    setLastEmail(email);
    const profile = response?.user || response?.profile || null;
    if (profile) {
      setUser(profile);
    } else {
      setUser((prev) => ({
        ...prev,
        email,
        name: response?.full_name || email?.split("@")[0] || "Player",
      }));
    }
    return response;
  }, []);

  const logout = useCallback(() => {
    logoutService();
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  const forgotPassword = useCallback(async (email) => {
    const response = await forgotPasswordService(email);
    setLastEmail(email);
    return response;
  }, []);

  const establishSession = useCallback((response) => {
    if (!response || typeof response !== "object") return;
    const profile = response.profile || response.user || null;
    if (profile) {
      setUser(profile);
    } else {
      setUser((prev) => prev ?? null);
    }
    if (typeof response.email === "string" && response.email.trim()) {
      setLastEmail(response.email.trim());
    } else if (typeof profile?.email === "string" && profile.email.trim()) {
      setLastEmail(profile.email.trim());
    }
    setIsAuthenticated(true);
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated,
      loading,
      user,
      login,
      logout,
      forgotPassword,
      establishSession,
      lastEmail,
    }),
    [establishSession, forgotPassword, isAuthenticated, lastEmail, loading, login, logout, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
