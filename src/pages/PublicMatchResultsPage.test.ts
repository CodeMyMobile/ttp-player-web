import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowEstimateBadge } from "../utils/ratingBadges";

test("estimate badge follows is_estimate, not provisional K status", () => {
  assert.equal(shouldShowEstimateBadge({ is_provisional: true, is_estimate: false }), false);
  assert.equal(shouldShowEstimateBadge({ is_provisional: false, is_estimate: true }), true);
});
