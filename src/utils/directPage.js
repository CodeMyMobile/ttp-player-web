// Pay links (/pay/:token) and vendor pages (/:vendorSlug) live on the real path,
// outside the hash routes. A bare "#/" is what HashRouter adds on load, so it
// doesn't count as a route of its own.
export const readDirectPage = ({ pathname = "", hash = "" } = {}) => {
  const hashPath = hash.replace(/^#/, "");
  if (hashPath.startsWith("/") && hashPath !== "/") return null;
  const payMatch = pathname.match(/^\/pay\/([^/?#]+)/);
  if (payMatch) return { payToken: decodeURIComponent(payMatch[1]) };
  const vendorMatch = pathname.match(/^\/([^/?#]+)\/?$/);
  if (vendorMatch && vendorMatch[1] !== "pay") return { vendorSlug: decodeURIComponent(vendorMatch[1]) };
  return null;
};
