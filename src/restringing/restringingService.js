import api, { unwrap } from "../services/api.js";
import { mergeTierCatalogs } from "./playerFlow.js";

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

// String-first needs one flat catalog, but the API is scoped per service tier.
// Fetch each string tier's catalog ONCE and merge — the caller caches the result
// and filters it client-side per keystroke (never re-fetches while typing).
export async function assembleVendorCatalog({ vendorId, tiers = [] }) {
  const stringTiers = (tiers || []).filter((tier) => tier && tier.string_category);
  const tierCatalogs = await Promise.all(
    stringTiers.map((tier) =>
      listVendorStrings({ vendorId, serviceTierId: tier.id })
        .then((data) => ({ tier, catalog: (data && data.catalog) || [] }))
        .catch((err) => ({ tier, catalog: [], error: err })),
    ),
  );
  if (import.meta.env.DEV) {
    // Dev-only: per-tier breakdown — shows whether each catalog fetch returned rows or errored.
    console.log(
      `%c[restring] catalog vendor ${vendorId} · ${stringTiers.length} string tiers →`,
      "color:#7c3aed;font-weight:700",
      tierCatalogs.map((tc) => `t${tc.tier.id}/${tc.tier.string_category}:${tc.catalog.length}${tc.error ? `!(${tc.error.status || "err"})` : ""}`).join("  "),
    );
  }
  return mergeTierCatalogs(tierCatalogs);
}

export const captureVendorLead = (payload) =>
  unwrap(api("/restringing/vendor-leads", {
    method: "POST",
    json: payload,
  }));

export const listSavedPaymentMethods = () =>
  unwrap(api("/player/stripe/payment_method_list"));

export const createCheckoutOrder = ({ vendorId, items, paymentMethodId = null }) =>
  unwrap(api("/player/restringing/checkout", {
    method: "POST",
    json: {
      vendor_id: vendorId,
      items,
      ...(paymentMethodId ? { payment_method_id: paymentMethodId } : {}),
    },
  }));

export const listMyOrders = () =>
  unwrap(api("/player/restringing/orders")).then((data) => data.orders || []);

export const cancelOrder = (orderId) =>
  unwrap(api(`/player/restringing/orders/${orderId}/cancel`, {
    method: "POST",
    json: { reason: "player_cancelled_before_dropoff" },
  }));
