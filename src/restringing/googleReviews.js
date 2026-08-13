const clean = (value) => String(value || "").trim();

export function hasGoogleSummary(vendor = {}) {
  const google = vendor.google || {};
  return Number.isFinite(Number(google.rating)) && Number(google.user_ratings_total) > 0;
}

export function googleReviewsForVendor(vendor = {}) {
  const reviews = Array.isArray(vendor.google?.reviews) ? vendor.google.reviews : [];
  return reviews.slice(0, 5).map((review) => ({
    authorName: clean(review.author_name) || "Google reviewer",
    authorPhotoUri: clean(review.author_photo_uri),
    authorUri: clean(review.author_uri),
    rating: googleReviewStars(review.rating),
    relativeTimeDescription: clean(review.relative_time_description),
    text: clean(review.text),
    googleMapsUri: clean(review.google_maps_uri || review.author_uri),
  }));
}

export function googleReviewStars(value) {
  const rating = Math.round(Number(value));
  if (!Number.isFinite(rating)) return 0;
  return Math.max(0, Math.min(5, rating));
}

export function googleReviewInitial(review = {}) {
  return clean(review.authorName || review.author_name || "Google reviewer").slice(0, 1).toUpperCase() || "G";
}

export function googleMapsUriForVendor(vendor = {}) {
  return clean(vendor.google?.google_maps_uri || vendor.google_business_url);
}
