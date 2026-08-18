import { buildApiUrl } from "../api/config";
import { getStoredAuthToken, normalizeAuthToken } from "./authToken";
import { refreshSession } from "./auth";

const api = (path, options = {}) => {
  const {
    headers: optionHeaders = {},
    body: providedBody,
    json,
    authSchemePreference = "token",
    authToken,
    credentials: providedCredentials,
    ...rest
  } = options;

  const hasAuthTokenOption = Object.prototype.hasOwnProperty.call(
    options,
    "authToken",
  );
  const token = hasAuthTokenOption
    ? normalizeAuthToken(authToken, { preferScheme: authSchemePreference })
    : getStoredAuthToken({ preferScheme: authSchemePreference });

  const headers = {
    Accept: "application/json",
    ...optionHeaders,
  };

  let body = providedBody;

  if (json !== undefined) {
    body = JSON.stringify(json);
    if (!Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
      headers["Content-Type"] = "application/json";
    }
  }

  const hasBody = body !== undefined && body !== null && body !== "";
  const isStringBody = typeof body === "string";
  if (
    hasBody &&
    isStringBody &&
    json === undefined &&
    !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")
  ) {
    headers["Content-Type"] = "application/json";
  }

  if (token) headers.Authorization = token;
  const url = buildApiUrl(path);
  // Default to no cookies to avoid CORS credential restrictions unless explicitly requested
  const credentials = providedCredentials ?? "omit";
  const fetchOptions = {
    ...rest,
    credentials,
    headers,
    ...(hasBody ? { body } : {}),
  };

  return fetch(url, fetchOptions).then(async (response) => {
    if (response.status !== 401 || !token || path === "/auth/refresh-token") {
      return response;
    }

    try {
      await refreshSession();
      const refreshedToken = getStoredAuthToken({ preferScheme: authSchemePreference });
      return fetch(url, {
        ...fetchOptions,
        headers: {
          ...headers,
          ...(refreshedToken ? { Authorization: refreshedToken } : {}),
        },
      });
    } catch {
      // Refresh failed — don't wipe the session. Return the original 401
      // response so the caller can handle it, same as before the
      // refresh-and-retry mechanism was added.
      return response;
    }
  });
};

export const unwrap = (p) =>
  p.then(async (r) => {
    let data = null;
    try {
      data = await r.json();
    } catch {
      // ignore non-JSON responses
    }
    if (!r.ok) {
      const msg = data?.detail || data?.message || data?.error || r.statusText || "API_ERROR";
      const error = new Error(msg);
      error.status = r.status;
      error.data = data;
      error.response = {
        data,
        status: r.status,
        statusText: r.statusText,
      };
      throw error;
    }
    return data;
  });

export default api;
