import { request } from "./http";

export interface StripeSetupIntentResponse {
  client_secret: string;
  [key: string]: unknown;
}

export interface StripePaymentIntentResponse {
  client_secret: string;
  [key: string]: unknown;
}

export interface StripeCardDetails {
  brand?: string;
  last4?: string;
  exp_month?: number;
  exp_year?: number;
  [key: string]: unknown;
}

export interface PlayerStripePaymentMethod {
  id: string;
  card?: StripeCardDetails;
  billing_details?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    [key: string]: unknown;
  } | null;
  is_default?: boolean;
  default?: boolean;
  default_for_currency?: boolean;
  [key: string]: unknown;
}

export interface PlayerStripePaymentMethodListResponse {
  data?: PlayerStripePaymentMethod[];
  payment_methods?: PlayerStripePaymentMethod[];
  results?: PlayerStripePaymentMethod[];
  default_payment_method_id?: string;
  default_payment_method?: string;
  [key: string]: unknown;
}

export const getPlayerStripeSetupIntent = (token: string) =>
  request<StripeSetupIntentResponse>("/player/stripe/setupintent", {
    token,
  });

export interface CreatePlayerStripePaymentIntentParams {
  token: string;
  lessonId: number | string;
  paymentMethodId?: string;
}

export const createPlayerStripePaymentIntent = ({
  token,
  lessonId,
  paymentMethodId,
}: CreatePlayerStripePaymentIntentParams) =>
  request<StripePaymentIntentResponse>("/player/stripe/paymentintent", {
    method: "POST",
    token,
    body: {
      lesson_id: lessonId,
      ...(paymentMethodId ? { payment_method_id: paymentMethodId } : {}),
    },
  });

export const getPlayerStripePaymentMethods = (token: string) =>
  request<PlayerStripePaymentMethodListResponse | PlayerStripePaymentMethod[]>(
    "/player/stripe/payment_method_list",
    {
      token,
    },
  );

export const setPlayerDefaultPaymentMethod = (token: string, paymentMethodId: string) =>
  request<unknown>("/player/stripe/payment_method_default", {
    method: "POST",
    token,
    body: {
      payment_method_id: paymentMethodId,
    },
  });

export const detachPlayerPaymentMethod = (token: string, paymentMethodId: string) =>
  request<unknown>("/player/stripe/payment_method_detach", {
    method: "POST",
    token,
    body: {
      payment_method_id: paymentMethodId,
    },
  });
