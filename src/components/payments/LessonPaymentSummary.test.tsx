import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import LessonPaymentSummary from "./LessonPaymentSummary";

const pricing = {
  hourly_rate: 40,
  lesson_type_name: "Private",
};

test("LessonPaymentSummary hides booking and card fees for pay on court", () => {
  const markup = renderToStaticMarkup(
    <LessonPaymentSummary
      pricing={pricing}
      formatMoney={(value) => `$${value.toFixed(2)}`}
      paymentMethod="pay-on-court"
    />,
  );

  assert.match(markup, /Due to coach on lesson day/);
  assert.doesNotMatch(markup, /Booking fee/);
  assert.doesNotMatch(markup, /Card processing/);
});

test("LessonPaymentSummary shows fees for card payments", () => {
  const markup = renderToStaticMarkup(
    <LessonPaymentSummary
      pricing={pricing}
      formatMoney={(value) => `$${value.toFixed(2)}`}
      paymentMethod="card"
    />,
  );

  assert.match(markup, /Booking fee/);
  assert.match(markup, /Card processing/);
});
