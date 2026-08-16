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
