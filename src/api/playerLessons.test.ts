import assert from "node:assert/strict";
import test from "node:test";

import { bookGroupLessonWithCard, requestPrivateLesson } from "./playerLessons";

const mockJsonResponse = (payload: unknown = {}) =>
  ({
    ok: true,
    status: 200,
    json: async () => payload,
  }) as Response;

test("bookGroupLessonWithCard sends pay-on-court without a payment method id", async () => {
  const previousFetch = globalThis.fetch;
  let capturedInit: RequestInit | undefined;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedInit = init;
    return mockJsonResponse({ id: 1 });
  }) as typeof fetch;

  try {
    await bookGroupLessonWithCard({
      token: "token-123",
      lessonId: 42,
      paymentMethod: "pay_on_court",
    });

    assert.equal(capturedInit?.method, "POST");
    assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
      payment_method: "pay_on_court",
    });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("requestPrivateLesson sends pay-on-court without a card payment method id", async () => {
  const previousFetch = globalThis.fetch;
  let capturedInit: RequestInit | undefined;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedInit = init;
    return mockJsonResponse({ id: 9 });
  }) as typeof fetch;

  try {
    await requestPrivateLesson({
      token: "token-123",
      coachId: 7,
      startDateTime: "2026-07-16T14:00:00.000Z",
      endDateTime: "2026-07-16T15:00:00.000Z",
      startDateTimeTz: "2026-07-16T14:00:00.000Z",
      endDateTimeTz: "2026-07-16T15:00:00.000Z",
      locationId: 5,
      status: "PENDING",
      paymentMethod: "pay_on_court",
    });

    assert.equal(capturedInit?.method, "POST");
    const body = JSON.parse(String(capturedInit?.body));
    assert.equal(body.payment_method, "pay_on_court");
    assert.equal(body.payment_method_id, undefined);
    assert.equal(body.status, "PENDING");
  } finally {
    globalThis.fetch = previousFetch;
  }
});
