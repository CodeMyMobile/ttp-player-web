export function vendorSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function findVendorBySlug(vendors, slug) {
  const normalizedSlug = vendorSlug(slug);
  if (!normalizedSlug) return null;
  return (Array.isArray(vendors) ? vendors : [])
    .find((vendor) => vendorSlug(vendor?.name) === normalizedSlug) || null;
}

export function vendorProfilePath(vendor) {
  const slug = vendorSlug(vendor?.slug || vendor?.name);
  return slug ? `/${slug}` : "/restring";
}
