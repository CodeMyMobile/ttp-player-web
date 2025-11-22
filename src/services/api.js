import { API_BASE_URL, DEFAULT_AUTH_SCHEME } from "../api/config";
import { getStoredAuthToken, normalizeAuthToken } from "./authToken";

const baseURL = API_BASE_URL.replace(/\/+$/, "");

const api = (path, options = {}) => {
  const {
    headers: optionHeaders = {},
    body: providedBody,
    json,
    authSchemePreference = DEFAULT_AUTH_SCHEME,
    authToken,
    credentials: providedCredentials,
    ...rest
  } = options;

  const token = authToken
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
  // Allow absolute URLs by not prefixing baseURL when path looks absolute
  const isAbsolute = /^https?:\/\//i.test(path);
  const relativePath = path.startsWith("/") ? path : `/${path}`;
  const url = isAbsolute ? path : `${baseURL}${relativePath}`;
  // Default to no cookies to avoid CORS credential restrictions unless explicitly requested
  const credentials = providedCredentials ?? "omit";
  return fetch(url, {
    ...rest,
    credentials,
    headers,
    ...(hasBody ? { body } : {}),
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
      const msg = data?.error || r.statusText || "API_ERROR";
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
