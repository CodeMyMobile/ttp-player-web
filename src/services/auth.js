import api, { unwrap } from "./api";
import { getPhoneDigits } from "./phone";

const AUTH_BASE =
  import.meta.env.VITE_API_URL ||
  "https://ttp-api.codemymobile.com/api";

export const login = async (email, password) => {
  const data = await unwrap(
    api(`/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
  );
  if (data?.access_token) {
    localStorage.setItem("authToken", data.access_token);
  }
  if (data?.token && !data?.access_token) {
    localStorage.setItem("authToken", data.token);
  }
  if (data?.refresh_token) {
    localStorage.setItem("refreshToken", data.refresh_token);
  }
  return data;
};

export const signup = async ({ email, password, name, phone, user_type = 2 }) => {
  const normalizedPhone = getPhoneDigits(phone);

  const payload = {
    email,
    password,
    user_type,
    // Common backend field names; adjust if your API differs
    full_name: name,
    ...(normalizedPhone ? { phone: normalizedPhone } : {}),
  };
  const data = await unwrap(
    api(`/auth/signup`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  );
  if (data?.access_token) {
    localStorage.setItem("authToken", data.access_token);
  }
  if (data?.token && !data?.access_token) {
    localStorage.setItem("authToken", data.token);
  }
  if (data?.refresh_token) {
    localStorage.setItem("refreshToken", data.refresh_token);
  }
  return data;
};

export const getPersonalDetails = async () =>
  unwrap(
    api(`/player/personal_details`, {
      authSchemePreference: "token",
    }),
  );

export const logout = () => {
  localStorage.removeItem("authToken");
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
