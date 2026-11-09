import api, { unwrap } from "../services/api.js";

const qs = (params) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : "";
};

export const listServiceTiers = () =>
  unwrap(api("/restringing/service-tiers")).then((data) => data.service_tiers || []);

export const listVendors = ({ lat = null, lng = null } = {}) =>
  unwrap(api(`/restringing/vendors${qs({ lat, lng })}`)).then((data) => data.vendors || []);

export const getVendorProfile = (vendorId) =>
  unwrap(api(`/restringing/vendors/${vendorId}`)).then((data) => data.vendor);

export const listVendorStrings = ({ vendorId, serviceTierId }) =>
  unwrap(api(`/restringing/vendors/${vendorId}/catalog${qs({ service_tier_id: serviceTierId })}`));

// The string recommendation engine (shared with the coach app): five answers and a shop in,
// { options: [pick, ...alternatives], warning } out.
export const recommendStrings = ({ vendorId, answers }) =>
  unwrap(api("/restringing/recommendations", { method: "POST", json: { vendor_id: vendorId, answers } }));

export const getClaimPreview = (token) =>
  unwrap(api(`/restringing/claim-links/${encodeURIComponent(token)}`));

export const claimRestringingOrder = (token) =>
  unwrap(api(`/player/restringing/claim-links/${encodeURIComponent(token)}`, {
    method: "POST",
  }));

export const captureVendorLead = (payload) =>
  unwrap(api("/restringing/vendor-leads", {
    method: "POST",
    json: payload,
  }));

export const listSavedPaymentMethods = () =>
  unwrap(api("/player/stripe/payment_method_list"));

// comp in the response: a discount code made the order free, so it is already paid and
// there is no client_secret.
export const createCheckoutOrder = ({ vendorId, items, paymentMethodId = null, discountCode = null }) =>
  unwrap(api("/player/restringing/checkout", {
    method: "POST",
    json: {
      vendor_id: vendorId,
      items,
      ...(paymentMethodId ? { payment_method_id: paymentMethodId } : {}),
      ...(discountCode ? { discount_code: discountCode } : {}),
    },
  }));

/** The shop's add-ons and the order priced by the API (with any discount code), before ordering. */
export const quoteCheckout = ({ vendorId, items, discountCode = null }) =>
  unwrap(api("/player/restringing/quote", {
    method: "POST",
    json: {
      vendor_id: vendorId,
      items,
      ...(discountCode ? { discount_code: discountCode } : {}),
    },
  }));

export const listMyOrders = () =>
  unwrap(api("/player/restringing/orders")).then((data) => data.orders || []);

// My strings: every racket strung and collected, with the player's rating, whether they've
// agreed to ratings being used, and their game profile.
export const listMyStrings = () =>
  unwrap(api("/player/restringing/strings"));

export const rateMyString = (orderItemId, body) =>
  unwrap(api(`/player/restringing/strings/${orderItemId}/rating`, { method: "PUT", json: body }))
    .then((data) => data.string);

// The string questions' answers (and swing and style), kept on the player's profile.
export const saveGameProfile = (answers) =>
  unwrap(api("/player/restringing/game-profile", { method: "POST", json: { answers } }))
    .then((data) => data.profile);

export const cancelOrder = (orderId) =>
  unwrap(api(`/player/restringing/orders/${orderId}/cancel`, {
    method: "POST",
    json: { reason: "player_cancelled_before_dropoff" },
  }));
