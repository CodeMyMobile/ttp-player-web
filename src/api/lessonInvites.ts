import { request } from "./http";
import type { PlayerStripePaymentMethod, PlayerStripePaymentMethodListResponse, StripeSetupIntentResponse } from "./playerStripe";

export interface LessonInviteClaimPayload {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
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

export type LessonInviteBeginResponse = {
  status?: string;
  state?: string;
  paymentRequired?: boolean;
  requires_payment?: boolean;
  redirect?: string;
  redirect_url?: string;
  [key: string]: unknown;
};

export interface LessonInviteActionResponse {
  redirect?: string;
  redirect_url?: string;
  [key: string]: unknown;
}

const normalizeInviteToken = (token: string) => encodeURIComponent(token.trim());

export const beginLessonInvite = (token: string) =>
  request<LessonInviteBeginResponse>(`/lesson-invites/${normalizeInviteToken(token)}/begin`, {
    method: "POST",
  });

export const claimLessonInvite = (token: string, payload: LessonInviteClaimPayload) =>
  request<LessonInviteClaimResponse>(`/lesson-invites/${normalizeInviteToken(token)}/claim`, {
    method: "POST",
    body: {
      full_name: payload.fullName,
      fullName: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      password: payload.password,
    },
  });

export const acceptLessonInvite = (token: string, authToken: string) =>
  request<LessonInviteActionResponse>(`/lesson-invites/${normalizeInviteToken(token)}/accept`, {
    method: "POST",
    token: authToken,
  });

interface PayLessonInviteParams {
  token: string;
  authToken: string;
  paymentMethodId: string;
  payEndpoint?: string | null;
}

export const payLessonInvite = ({ token, authToken, paymentMethodId, payEndpoint }: PayLessonInviteParams) =>
  request<LessonInviteActionResponse>(
    payEndpoint?.trim() || `/lesson-invites/${normalizeInviteToken(token)}/pay`,
    {
      method: "POST",
      token: authToken,
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
