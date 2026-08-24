import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  forgotPassword as forgotPasswordService,
  isSessionTokenPayloadValid,
  login as loginService,
  logout as logoutService,
  refreshSession,
} from "../services/auth.js";
import { getStoredAuthToken } from "../services/authToken.js";

const AuthContext = createContext({});

const readStoredJson = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getStoredUser = () => {
  const authResponse = readStoredJson("authLoginResponse");
  return (
    authResponse?.profile ||
    authResponse?.user ||
    readStoredJson("playerPersonalDetails") ||
    readStoredJson("user") ||
    null
  );
};

const isExpiredJwt = (token) => {
  const jwt = String(token || "").trim().split(/\s+/).pop();
  if (!jwt) return false;

  try {
    const payload = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp * 1000 <= Date.now();
  } catch {
    return false;
  }
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [lastEmail, setLastEmail] = useState("");

  useEffect(() => {
    let active = true;

    const initializeSession = async () => {
      const token = getStoredAuthToken();
      if (token && !isSessionTokenPayloadValid(token)) {
        logoutService();
      } else if (token && isExpiredJwt(token)) {
        try {
          await refreshSession();
        } catch {
          // Refresh unavailable — don't wipe the session.
          // The caller will see a 401 on the next request and can handle it.
        }
      }

      const currentToken = getStoredAuthToken();
      if (!active) return;
      setIsAuthenticated(Boolean(currentToken) && !isExpiredJwt(currentToken));
      setUser(currentToken && !isExpiredJwt(currentToken) ? getStoredUser() : null);
      setLoading(false);
    };

    initializeSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const syncStoredAuth = (event) => {
      const isAuthStorageKey =
        event?.key === "authToken" ||
        event?.key === "authLoginResponse" ||
        event?.key === "playerPersonalDetails" ||
        event?.key === "user";
      if (event?.key && !isAuthStorageKey) {
        return;
      }
      const token = getStoredAuthToken();
      const validToken = token && !isExpiredJwt(token);
      setIsAuthenticated(Boolean(validToken));
      setUser(validToken ? getStoredUser() : null);
    };

    window.addEventListener("storage", syncStoredAuth);
    window.addEventListener("auth:session-refreshed", syncStoredAuth);
    window.addEventListener("auth:session-expired", syncStoredAuth);
    return () => {
      window.removeEventListener("storage", syncStoredAuth);
      window.removeEventListener("auth:session-refreshed", syncStoredAuth);
      window.removeEventListener("auth:session-expired", syncStoredAuth);
    };
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
