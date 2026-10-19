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
  /** Set when the item is an add-on the player bought here at its bundle price. */
  add_on_offer_id?: number | null;
}

/** A product the shop sells at a bundle price alongside a restring. */
export interface RestringingPayLinkAddOnOffer {
  id: number;
  name: string;
  description: string | null;
  regular_price_cents: number;
  bundle_price_cents: number;
  taxable: boolean;
}

export interface RestringingPayLinkOrder {
  id: number;
  customer_first_name: string;
  masked_phone: string | null;
  payment_status: string;
  fulfillment_status: string;
  subtotal_cents: number;
  discount_label?: string | null;
  discount_type?: "percent" | "fixed" | null;
  discount_value?: number | null;
  discount_amount_cents?: number | null;
  /** True when the player applied the discount here with a code and can still take it off. */
  discount_removable?: boolean;
  /** The coach's commission, given to the player as a discount. Comes off after any other discount. */
  coach_discount_cents?: number | null;
  ordered_by_coach_name?: string | null;
  tax_cents: number;
  total_cents: number;
  items: RestringingPayLinkItem[];
}

export interface RestringingPayLinkSummary {
  order: RestringingPayLinkOrder;
  vendor: RestringingPayLinkVendor;
  account_link: RestringingPayLinkAccount;
  /** Offered while the order is unpaid and has a restring; absent from older APIs. */
  add_on_offers?: RestringingPayLinkAddOnOffer[];
}

export const isRestringingPayLinkPaid = (summary?: Pick<RestringingPayLinkSummary, "order"> | null) =>
  summary?.order.payment_status === "paid";

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

export const applyRestringingPayLinkDiscountCode = (
  token: string,
  code: string,
  authToken?: string | null,
) =>
  request<RestringingPayLinkSummary>(`/restringing/pay-links/${encodeToken(token)}/discount`, {
    method: "POST",
    token: authToken || undefined,
    authScheme: "Token",
    body: { code: code.trim() },
  });

export const removeRestringingPayLinkDiscountCode = (token: string, authToken?: string | null) =>
  request<RestringingPayLinkSummary>(`/restringing/pay-links/${encodeToken(token)}/discount`, {
    method: "DELETE",
    token: authToken || undefined,
    authScheme: "Token",
  });

/** Sets how many of an add-on the player is buying; 0 takes it off. Returns the repriced order. */
export const setRestringingPayLinkAddOnQuantity = (
  token: string,
  offerId: number,
  quantity: number,
  authToken?: string | null,
) =>
  request<RestringingPayLinkSummary>(`/restringing/pay-links/${encodeToken(token)}/add-ons/${offerId}`, {
    method: "PUT",
    token: authToken || undefined,
    authScheme: "Token",
    body: { quantity },
  });

/** How many of this offer are on the order now. */
export const addOnQuantity = (summary: Pick<RestringingPayLinkSummary, "order">, offerId: number) =>
  summary.order.items
    .filter((item) => Number(item.add_on_offer_id) === offerId)
    .reduce((count, item) => count + Number(item.item_qty || 0), 0);

const ADD_ON_ERRORS: Record<string, string> = {
  add_on_offer_not_found: "That offer has just ended.",
  add_on_needs_a_restring: "This offer comes with a restring.",
  invalid_add_on_quantity: "Choose how many you'd like.",
  payment_link_not_payable: "This order can no longer be changed.",
  payment_link_expired: "This payment link has expired.",
};

/** What to tell the player when changing an add-on fails. */
export const payLinkAddOnErrorMessage = (error: unknown) => {
  const detail = (error as { data?: { detail?: unknown } } | null)?.data?.detail;
  return (typeof detail === "string" && ADD_ON_ERRORS[detail]) || "Your order could not be updated. Try again.";
};

const DISCOUNT_CODE_ERRORS: Record<string, string> = {
  discount_code_required: "Enter a discount code.",
  discount_code_invalid: "That code isn't valid for this shop.",
  discount_code_attempts_exceeded: "Too many tries. Ask the shop to apply your discount.",
  discount_already_applied: "This order already has a discount.",
  discount_not_removable: "This discount was added by the shop and can't be removed here.",
  payment_link_not_payable: "This order can no longer be changed.",
  payment_link_expired: "This payment link has expired.",
};

/** What to tell the player when applying or removing a code fails. */
export const payLinkDiscountErrorMessage = (error: unknown) => {
  const detail = (error as { data?: { detail?: unknown } } | null)?.data?.detail;
  return (typeof detail === "string" && DISCOUNT_CODE_ERRORS[detail]) || "The discount could not be updated. Try again.";
};

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
