// Feature flags for the player web app.
//
// VITE_HOME_V2 gates the redesigned home page. Default OFF: when unset/false the
// existing DashboardPage renders unchanged, so the "flag off = identical to
// today" guarantee is structural rather than a matter of care.
const truthy = (value: unknown) =>
  value === true ||
  value === "1" ||
  value === "true" ||
  value === "on" ||
  value === "yes";

export const isHomeV2Enabled = () => truthy(import.meta.env?.VITE_HOME_V2);

// VITE_VENDOR_PAGE gates the redesigned public vendor page at /:vendorSlug. Default OFF: when
// unset/false the existing RestringingPlayerFlow renders for vendor links unchanged.
export const isVendorPageEnabled = () => truthy(import.meta.env?.VITE_VENDOR_PAGE);
