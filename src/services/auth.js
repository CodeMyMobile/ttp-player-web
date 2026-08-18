import { buildApiUrl } from "../api/config";
import api, { unwrap } from "./api";
import { getPhoneDigits } from "./phone";
import { withSmsConsent } from "./smsConsent";

const clearStoredSession = () => {
  localStorage.removeItem("authToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("authLoginResponse");
  localStorage.removeItem("playerPersonalDetails");
  localStorage.removeItem("oauthPhoneCapturePending");
  localStorage.removeItem("oauthPhoneCaptureProvider");
  localStorage.removeItem("user");
};

const persistAuthSession = (data) => {
  if (data?.access_token) {
    localStorage.setItem("authToken", data.access_token);
  }
  if (data?.token && !data?.access_token) {
    localStorage.setItem("authToken", data.token);
  }
  if (data?.refresh_token) {
    localStorage.setItem("refreshToken", data.refresh_token);
  }
  if (data) {
    localStorage.setItem("authLoginResponse", JSON.stringify(data));
  }
};

const getStoredRefreshToken = () => {
  try {
    return localStorage.getItem("refreshToken");
  } catch {
    return null;
  }
};

let refreshInFlight = null;

/**
 * Exchanges the rotating refresh JWT for a new session. This deliberately uses
 * fetch rather than the shared HTTP client so a failed refresh cannot recurse
 * through the 401 recovery interceptor.
 */
const requestSessionRefresh = async () => {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    const error = new Error("Missing refresh token");
    error.status = 401;
    throw error;
  }

  const response = await fetch(buildApiUrl("/auth/refresh-token"), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Token ${refreshToken}`,
    },
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Keep the status below even when a proxy returns a non-JSON error.
  }

  if (!response.ok) {
    const error = new Error(
      data?.detail || data?.message || data?.error || response.statusText || "Unable to refresh session",
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  persistAuthSession(data);
  window.dispatchEvent(new Event("auth:session-refreshed"));
  return data;
};

export const refreshSession = () => {
  if (!refreshInFlight) {
    refreshInFlight = requestSessionRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
};

export const getApplePlayerLoginUrl = () => buildApiUrl("/auth/apple");

export const consumeAppleAuthRedirect = () => {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash || "";
  if (!hash || hash.startsWith("#/")) return null;

  const params = new URLSearchParams(hash.slice(1));
  const accessToken = params.get("access_token");
  const token = params.get("token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken && !token && !refreshToken) {
    return null;
  }

  const response = Object.fromEntries(params.entries());
  response.oauth_provider = response.oauth_provider || response.provider || "apple";
  persistAuthSession(response);
  localStorage.setItem("oauthPhoneCapturePending", "true");
  localStorage.setItem("oauthPhoneCaptureProvider", "apple");

  const cleanUrl = `${window.location.pathname}${window.location.search}#/`;
  window.history.replaceState({}, document.title, cleanUrl);

  return response;
};

export const login = async (email, password) => {
  const data = await unwrap(
    api(`/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
  );
  if (Number(data?.user_type) === 1) {
    clearStoredSession();
    const error = new Error("Coach accounts can’t sign in to the player app.");
    error.response = {
      data: {
        error: "Coach accounts can’t sign in to the player app.",
      },
    };
    throw error;
  }
  persistAuthSession(data);
  return data;
};

export const signup = async ({ email, password, name, phone, user_type = 2, smsConsentGranted = false }) => {
  const normalizedPhone = getPhoneDigits(phone);

  const payload = withSmsConsent(
    {
      email,
      password,
      user_type,
      // Common backend field names; adjust if your API differs
      full_name: name,
      ...(normalizedPhone ? { phone: normalizedPhone } : {}),
    },
    Boolean(normalizedPhone) && smsConsentGranted,
    "signup_checkbox",
  );
  const data = await unwrap(
    api(`/auth/signup`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  );
  persistAuthSession(data);
  return data;
};

export const googlePlayerLogin = async (idToken) => {
  const data = await unwrap(
    api(`/auth/google/player-login`, {
      method: "POST",
      body: JSON.stringify({ id_token: idToken }),
    }),
  );

  persistAuthSession(data);

  return data;
};

export const getPersonalDetails = async () => {
  const data = await unwrap(
    api(`/player/personal_details`, {
      authSchemePreference: "token",
    }),
  );
  if (data) {
    localStorage.setItem("playerPersonalDetails", JSON.stringify(data));
  }
  return data;
};

export const logout = () => {
  clearStoredSession();
};

export const forgotPassword = async (email) =>
  unwrap(
    api(`/auth/forgot-password`, {
      method: "POST",
      body: JSON.stringify({ email }),
    })
  );

export const resetPassword = async ({ token, email, password }) =>
  unwrap(
    api(`/auth/reset-password/${token}/${encodeURIComponent(email)}`, {
      method: "PATCH",
      body: JSON.stringify({ password }),
    })
  );
