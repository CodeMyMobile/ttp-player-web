import api, { unwrap } from "./api";
import { getPhoneDigits } from "./phone";
import {
  clearStoredAuthToken,
  clearStoredRefreshToken,
  getStoredRefreshToken,
  storeAuthToken,
  storeRefreshToken,
} from "./authToken";

const AUTH_BASE =
  import.meta.env.VITE_API_URL ||
  "https://ttp-api.codemymobile.com/api";

const persistTokensFromResponse = (data) => {
  if (!data || typeof data !== "object") return;
  const token = data.access_token || data.token;
  const refreshToken = data.refresh_token;
  if (token) {
    storeAuthToken(token);
  }
  if (refreshToken) {
    storeRefreshToken(refreshToken, { maxAgeDays: 60 });
  }
};

export const login = async (email, password) => {
  const data = await unwrap(
    api(`/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  );
  persistTokensFromResponse(data);
  return data;
};

export const signup = async ({ email, password, name, phone, user_type = 2 }) => {
  const normalizedPhone = getPhoneDigits(phone);
  const trimmedName = typeof name === "string" ? name.trim() : "";

  if (!trimmedName) {
    const error = new Error("Please enter your full name to continue.");
    error.fieldErrors = { fullName: "Please enter your full name" };
    throw error;
  }

  const payload = {
    email,
    password,
    user_type,
    // Common backend field names; adjust if your API differs
    full_name: trimmedName,
    name: trimmedName,
    ...(normalizedPhone ? { phone: normalizedPhone } : {}),
  };
  const data = await unwrap(
    api(`/auth/signup`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
  persistTokensFromResponse(data);
  return data;
};

export const getPersonalDetails = async () =>
  unwrap(
    api(`/player/personal_details/`, {
      authSchemePreference: "token",
    }),
  );

export const logout = () => {
  clearStoredAuthToken();
  clearStoredRefreshToken();
};

const refreshEndpoints = [
  "/auth/refresh",
  "/auth/refresh-token",
  "/auth/refresh_token",
];

export const refreshSession = async (providedRefreshToken) => {
  const refreshToken = (providedRefreshToken || getStoredRefreshToken() || "").trim();
  if (!refreshToken) {
    throw new Error("Missing refresh token");
  }

  let lastError = null;

  for (const endpoint of refreshEndpoints) {
    try {
      const data = await unwrap(
        api(endpoint, {
          method: "POST",
          json: { refresh_token: refreshToken },
        }),
      );
      persistTokensFromResponse(data);
      return data;
    } catch (error) {
      lastError = error;
      const status = Number(error?.status ?? error?.response?.status);
      if (status && ![404, 405].includes(status)) {
        break;
      }
    }
  }

  if (lastError) throw lastError;
  throw new Error("Unable to refresh session");
};

export const forgotPassword = async (email) =>
  unwrap(
    api(`${AUTH_BASE}/auth/forgot-password`, {
      method: "POST",
      body: JSON.stringify({ email }),
    })
  );

export const resetPassword = async ({ token, email, password }) =>
  unwrap(
    api(`${AUTH_BASE}/auth/reset-password/${token}/${encodeURIComponent(email)}`, {
      method: "PATCH",
      body: JSON.stringify({ password }),
    })
  );
