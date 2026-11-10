import api, { unwrap } from "../services/api.js";

// Every catalog string, stocked or not, for naming a player's own string (ttp-api GET
// /restringing/strings). With a shop, in_stock says whether it stocks it.
export const listAllStrings = ({ vendorId = null } = {}) =>
  unwrap(api(`/restringing/strings${vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : ""}`)).then((data) => data.strings || []);
