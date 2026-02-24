import { request } from "./http";
import type { PlayerStripePaymentMethod, PlayerStripePaymentMethodListResponse, StripeSetupIntentResponse } from "./playerStripe";

export interface LessonInviteClaimPayload {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
}

export interface LessonInviteClaimResponse {
  access_token?: string;
  refresh_token?: string;
  requires_payment?: boolean;
  paymentRequired?: boolean;
  pay_endpoint?: string;
  payEndpoint?: string;
  redirect?: string;
  redirect_url?: string;
  [key: string]: unknown;
}

export interface LessonInviteQuickSignupPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
}

export interface LessonInviteQuickSignupResponse extends LessonInviteClaimResponse {
  user_id?: number | string;
  user_type?: number | string;
  profile?: Record<string, unknown>;
}

export type LessonInviteBeginResponse = {
  status?: string;
  state?: string;
  paymentRequired?: boolean;
  requires_payment?: boolean;
  redirect?: string;
  redirect_url?: string;
  quickSignup?: {
    required?: boolean;
    endpoint?: string;
    prefill?: {
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export interface LessonInviteActionResponse {
  message?: string;
  redirect?: string;
  redirect_url?: string;
  [key: string]: unknown;
}

const normalizeInviteToken = (token: string) => encodeURIComponent(token.trim());

const normalizeInviteEndpoint = (token: string, endpoint: string | null | undefined, suffix: string) => {
  const fallback = `/lesson-invites/${normalizeInviteToken(token)}/${suffix}`;
  if (!endpoint || !endpoint.trim()) {
    return fallback;
  }

  const raw = endpoint.trim();
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  if (raw.startsWith("/api/")) {
    return raw.slice(4);
  }
  if (raw === "/api") {
    return fallback;
  }
  return raw;
};

export const beginLessonInvite = (token: string) =>
  request<LessonInviteBeginResponse>(`/lesson-invites/${normalizeInviteToken(token)}/begin`, {
    method: "POST",
  });

export const claimLessonInvite = (token: string, payload: LessonInviteClaimPayload = {}) =>
  request<LessonInviteClaimResponse>(`/lesson-invites/${normalizeInviteToken(token)}/claim`, {
    method: "POST",
    body: {
      ...(payload.fullName ? { full_name: payload.fullName, fullName: payload.fullName } : {}),
      ...(payload.email ? { email: payload.email } : {}),
      ...(payload.phone ? { phone: payload.phone } : {}),
      ...(payload.password ? { password: payload.password } : {}),
    },
  });

export const quickSignupLessonInvite = (
  token: string,
  payload: LessonInviteQuickSignupPayload,
  endpoint?: string | null,
) =>
  request<LessonInviteQuickSignupResponse>(
    normalizeInviteEndpoint(token, endpoint, "quick-signup"),
    {
      method: "POST",
      body: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        fullName: `${payload.firstName} ${payload.lastName}`.trim(),
        full_name: `${payload.firstName} ${payload.lastName}`.trim(),
        email: payload.email,
        ...(payload.phone ? { phone: payload.phone } : {}),
        password: payload.password,
        confirmPassword: payload.confirmPassword,
      },
    },
  );

export const acceptLessonInvite = (token: string, authToken: string) =>
  request<LessonInviteActionResponse>(`/lesson-invites/${normalizeInviteToken(token)}/accept`, {
    method: "POST",
    token: authToken,
  });

export const rejectLessonInvite = (token: string, authToken: string) =>
  request<LessonInviteActionResponse>(`/lesson-invites/${normalizeInviteToken(token)}/reject`, {
    method: "POST",
    token: authToken,
  });

interface PayLessonInviteParams {
  token: string;
  authToken: string;
  paymentMethodId: string;
  payEndpoint?: string | null;
}

const normalizePayEndpoint = (token: string, payEndpoint?: string | null) => {
  const fallback = `/lesson-invites/${normalizeInviteToken(token)}/pay`;
  if (!payEndpoint || !payEndpoint.trim()) {
    return fallback;
  }

  const raw = payEndpoint.trim();
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  // API base already includes "/api", so strip duplicated prefix from backend-provided paths.
  if (raw.startsWith("/api/")) {
    return raw.slice(4);
  }
  if (raw === "/api") {
    return fallback;
  }
  return raw;
};

export const payLessonInvite = ({ token, authToken, paymentMethodId, payEndpoint }: PayLessonInviteParams) =>
  request<LessonInviteActionResponse>(
    normalizePayEndpoint(token, payEndpoint),
    {
      method: "POST",
      token: authToken,
      authScheme: "Bearer",
      body: {
        payment_method_id: paymentMethodId,
      },
    },
  );

export const getLessonInviteStripeSetupIntent = (authToken: string) =>
  request<StripeSetupIntentResponse>("/player/stripe/setupintent", {
    token: authToken,
  });

export const getLessonInviteStripePaymentMethods = (authToken: string) =>
  request<PlayerStripePaymentMethodListResponse | PlayerStripePaymentMethod[]>(
    "/player/stripe/payment_method_list",
    {
      token: authToken,
    },
  );
