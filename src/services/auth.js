import api, { unwrap } from "./api";
import { getPhoneDigits } from "./phone";

export const login = async (email, password) => {
  const data = await unwrap(
    api(`/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
  );
  if (data) {
    localStorage.setItem("authLoginResponse", JSON.stringify(data));
  }
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
  localStorage.removeItem("authToken");
  localStorage.removeItem("authLoginResponse");
  localStorage.removeItem("playerPersonalDetails");
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
