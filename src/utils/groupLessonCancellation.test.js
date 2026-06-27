import assert from "node:assert/strict";
import test from "node:test";

import {
  getGroupLessonCheckoutButtonLabel,
  isCancelledGroupLessonRecord,
  isGroupLessonCheckoutDisabled,
} from "./groupLessonCancellation.js";

test("coach-cancelled group lesson tolerates string and number actor ids", () => {
  assert.equal(
    isCancelledGroupLessonRecord({
      status: "2",
      created_by: 26,
      updated_by: "26",
    }),
    true,
  );
});

test("checkout is disabled and labelled cancelled for cancelled group lessons", () => {
  assert.equal(
    isGroupLessonCheckoutDisabled({
      isConfirmed: false,
      isConsumingCredits: false,
      isPurchasingPackage: false,
      isProcessingPayment: false,
      hasPendingCreditConfirm: false,
      isUsingNewCard: false,
      groupLessonLoading: false,
      isUsingCredits: false,
      canUseCredits: false,
      creditsLoading: false,
      hasAuthToken: true,
      groupLessonCancelled: true,
    }),
    true,
  );
  assert.equal(
    getGroupLessonCheckoutButtonLabel({
      isUsingCredits: false,
      isConsumingCredits: false,
      isProcessingPayment: false,
      groupLessonCancelled: true,
      totalPriceLabel: "$40.00",
    }),
    "Cancelled",
  );
});
