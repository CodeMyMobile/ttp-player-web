import assert from "node:assert/strict";
import test from "node:test";

import {
  googleReviewInitial,
  googleReviewStars,
  googleReviewsForVendor,
  hasGoogleSummary,
} from "./googleReviews.js";

test("detects live Google summary on vendor profile payload", () => {
  assert.equal(hasGoogleSummary({ google: { rating: 4.8, user_ratings_total: 127 } }), true);
  assert.equal(hasGoogleSummary({ google_rating: 4.8, google_rating_count: 127 }), false);
});

test("normalizes Google reviews for profile display", () => {
  const reviews = googleReviewsForVendor({
    google: {
      reviews: [
        {
          author_name: "Julien M.",
          author_photo_uri: "https://lh3.googleusercontent.com/a-/julien",
          author_uri: "https://maps.google.com/contrib/julien",
          rating: 5,
          relative_time_description: "2 weeks ago",
          text: "Great stringing.",
          google_maps_uri: "https://maps.google.com/review/julien",
        },
      ],
    },
  });

  assert.deepEqual(reviews, [
    {
      authorName: "Julien M.",
      authorPhotoUri: "https://lh3.googleusercontent.com/a-/julien",
      authorUri: "https://maps.google.com/contrib/julien",
      rating: 5,
      relativeTimeDescription: "2 weeks ago",
      text: "Great stringing.",
      googleMapsUri: "https://maps.google.com/review/julien",
    },
  ]);
  assert.equal(googleReviewInitial(reviews[0]), "J");
  assert.equal(googleReviewStars(reviews[0].rating), 5);
  assert.equal(googleReviewStars(8), 5);
});
