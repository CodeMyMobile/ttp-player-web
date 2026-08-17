import { request } from "./http";

export type PayLinkAccountStatus = "hidden" | "login_available" | "linked";

export interface RestringingPayLinkAccount {
  eligible: boolean;
  status: PayLinkAccountStatus;
}

export interface RestringingPayLinkVendor {
  name: string;
  address: string | null;
  phone: string | null;
  hours: string | Record<string, string | null | undefined> | null;
}

export interface RestringingPayLinkItem {
  id: number;
  item_type?: "restring" | "custom";
  label?: string | null;
  item_qty?: number | null;
  racket_make_model?: string | null;
  service_tier_name?: string | null;
  string_description?: string | null;
  gauge?: string | null;
  tension_lbs_mains?: number | null;
  tension_lbs_crosses?: number | null;
  advice_requested?: boolean;
  unit_price_cents?: number;
}

export interface RestringingPayLinkOrder {
  id: number;
  customer_first_name: string;
  masked_phone: string | null;
  payment_status: string;
  fulfillment_status: string;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  items: RestringingPayLinkItem[];
}

export interface RestringingPayLinkSummary {
  order: RestringingPayLinkOrder;
  vendor: RestringingPayLinkVendor;
  account_link: RestringingPayLinkAccount;
}

export interface RestringingPayLinkCheckout {
  client_secret: string;
  stripe_account_id?: string | null;
}

export interface PayLinkSpecTile {
  label: string;
  value: string;
  sublabel: string;
  pending: boolean;
}

const encodeToken = (token: string) => encodeURIComponent(token.trim());

export const getRestringingPayLink = (token: string, authToken?: string | null) =>
  request<RestringingPayLinkSummary>(`/restringing/pay-links/${encodeToken(token)}`, {
    token: authToken || undefined,
    authScheme: "Token",
  });

export interface CreateRestringingPayLinkCheckoutOptions {
  paymentMethodId?: string | null;
}

export const createRestringingPayLinkCheckout = (
  token: string,
  authToken?: string | null,
  options: CreateRestringingPayLinkCheckoutOptions = {},
) =>
  request<RestringingPayLinkCheckout>(`/restringing/pay-links/${encodeToken(token)}/checkout`, {
    method: "POST",
    token: authToken || undefined,
    authScheme: "Token",
    body: options.paymentMethodId ? { payment_method_id: options.paymentMethodId } : undefined,
  });

export const formatPayLinkMoney = (cents: number | null | undefined) => {
  const amount = Number.isFinite(Number(cents)) ? Number(cents) : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount / 100);
};

export const buildVendorTelHref = (phone: string | null | undefined) => {
  if (!phone) return "";
  const normalized = phone.replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : "";
};

const VENDOR_HOUR_DAYS: Array<[string, string]> = [
  ["mon", "Mon"],
  ["tue", "Tue"],
  ["wed", "Wed"],
  ["thu", "Thu"],
  ["fri", "Fri"],
  ["sat", "Sat"],
  ["sun", "Sun"],
];

export const formatVendorHours = (
  hours: RestringingPayLinkVendor["hours"],
) => {
  if (!hours) return "";
  if (typeof hours === "string") return hours.trim();
  if (typeof hours !== "object") return "";

  return VENDOR_HOUR_DAYS
    .map(([key, label]) => {
      const value = hours[key];
      return typeof value === "string" && value.trim()
        ? `${label} ${value.trim()}`
        : "";
    })
    .filter(Boolean)
    .join(" · ");
};

const formatTension = (mains: number | null | undefined, crosses: number | null | undefined) => {
  if (mains == null && crosses == null) return "TBD";
  if (mains == null) return `- / ${crosses}`;
  if (crosses == null || Number(mains) === Number(crosses)) return String(Number(mains));
  return `${Number(mains)} / ${Number(crosses)}`;
};

export const getItemSpecs = (item: Pick<
  RestringingPayLinkItem,
  "item_type" | "advice_requested" | "gauge" | "tension_lbs_mains" | "tension_lbs_crosses"
>): PayLinkSpecTile[] => {
  if (item.item_type === "custom") return [];
  if (item.advice_requested) {
    return [{ label: "Specs", value: "TBD", sublabel: "at drop-off", pending: true }];
  }

  return [
    {
      label: "Tension",
      value: formatTension(item.tension_lbs_mains, item.tension_lbs_crosses),
      sublabel: "lbs",
      pending: false,
    },
    {
      label: "Gauge",
      value: item.gauge || "TBD",
      sublabel: "",
      pending: false,
    },
  ];
};

export const shouldShowAccountPrompt = (account: RestringingPayLinkAccount | null | undefined) =>
  Boolean(account?.eligible && account.status === "login_available");

export const isPayLinkDemoMode = (search: string | URLSearchParams | null | undefined) => {
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(search || "");
  return params.get("demo") === "1";
};
