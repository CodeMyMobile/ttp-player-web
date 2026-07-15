import assert from "node:assert/strict";
import test from "node:test";

import { getCoachProfilePaymentOptions } from "./coachProfilePaymentOptions";

test("includes pay-on-court when coach flag is enabled", () => {
  const options = getCoachProfilePaymentOptions({
    availableCredits: 0,
    applePayReady: false,
    coachAllowsPayOnCourt: true,
  });

  assert.ok(options.some((option) => option.value === "pay-on-court"));
});
