import { API_BASE_URL, DEFAULT_AUTH_SCHEME, buildApiUrl } from "./config";

export type AuthScheme = "token" | "Bearer" | (string & {});

export interface RequestQuery {
  [key: string]: string | number | boolean | null | undefined | Array<string | number | boolean>;
}

export interface RequestOptions<TBody = unknown> {
  method?: string;
  token?: string;
  authScheme?: AuthScheme;
  headers?: Record<string, string>;
  query?: RequestQuery;
  body?: TBody;
  signal?: AbortSignal;
  /**
   * When true, the body will be sent as provided (no JSON serialization, no content-type enforcement).
   * Useful for FormData or already serialized payloads.
   */
  rawBody?: boolean;
}

const buildQueryString = (query?: RequestQuery) => {
  if (!query) return "";
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item === undefined || item === null) return;
        params.append(key, String(item));
      });
      return;
    }
    params.append(key, String(value));
  });
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
};

const normalizeAuthHeader = (token?: string, scheme: AuthScheme = DEFAULT_AUTH_SCHEME) => {
  if (!token) return undefined;
  if (/^\s*([A-Za-z]+)\s+/i.test(token)) {
    // Token already includes scheme
    return token;
  }
  return `${scheme} ${token}`;
};

const isJsonLike = (body: unknown): body is Record<string, unknown> =>
  body !== null &&
  typeof body === "object" &&
  !(body instanceof FormData) &&
  !(body instanceof Blob) &&
  !(body instanceof ArrayBuffer) &&
  !(body instanceof URLSearchParams);

export async function request<TResponse = unknown, TBody = unknown>(
  path: string,
  {
    method = "GET",
    token,
    authScheme = DEFAULT_AUTH_SCHEME,
    headers = {},
    query,
    body,
    signal,
    rawBody = false,
  }: RequestOptions<TBody> = {},
): Promise<TResponse> {
  const url = buildApiUrl(path);
  const queryString = buildQueryString(query);
  const authHeader = normalizeAuthHeader(token, authScheme);

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };
  if (authHeader) {
    finalHeaders.Authorization = authHeader;
  }

  let finalBody: BodyInit | undefined;

  if (rawBody) {
    finalBody = body as BodyInit;
  } else if (body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer) {
    finalBody = body as BodyInit;
  } else if (body instanceof URLSearchParams) {
    finalBody = body as BodyInit;
    if (!finalHeaders["Content-Type"]) {
      finalHeaders["Content-Type"] = "application/x-www-form-urlencoded";
    }
  } else if (body !== undefined) {
    if (isJsonLike(body)) {
      finalBody = JSON.stringify(body);
      if (!finalHeaders["Content-Type"]) {
        finalHeaders["Content-Type"] = "application/json";
      }
    } else {
      finalBody = body as BodyInit;
    }
  }

  const response = await fetch(`${url}${queryString}`, {
    method,
    headers: finalHeaders,
    body: method === "GET" || method === "HEAD" ? undefined : finalBody,
    signal,
  });

  if (!response.ok) {
    let errorPayload: unknown;
    try {
      errorPayload = await response.json();
    } catch {
      // ignore
    }
    const error = new Error(
      (errorPayload as Record<string, unknown>)?.error as string ?? response.statusText ?? "Request failed",
    );
    (error as Error & { status?: number; data?: unknown }).status = response.status;
    (error as Error & { status?: number; data?: unknown }).data = errorPayload;
    throw error;
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}
