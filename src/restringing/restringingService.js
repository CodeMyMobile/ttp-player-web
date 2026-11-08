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

export const cancelOrder = (orderId) =>
  unwrap(api(`/player/restringing/orders/${orderId}/cancel`, {
    method: "POST",
    json: { reason: "player_cancelled_before_dropoff" },
  }));
