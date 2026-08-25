import assert from "node:assert/strict";
import test from "node:test";

import { createSingleFlightRequest, ensureCreditLessonId } from "./creditLessonBooking";

test("creates a player-requested private lesson and returns its numeric id for credits", async () => {
  let requestCount = 0;

  const lessonId = await ensureCreditLessonId({
    existingLessonId: undefined,
    isPlayerRequestedPrivateLesson: true,
    createPrivateLesson: async () => {
      requestCount += 1;
      return 912;
    },
  });

  assert.equal(lessonId, 912);
  assert.equal(requestCount, 1);
});

test("reuses an existing credit lesson id without creating a duplicate private lesson", async () => {
  let requestCount = 0;

  const lessonId = await ensureCreditLessonId({
    existingLessonId: 912,
    isPlayerRequestedPrivateLesson: true,
    createPrivateLesson: async () => {
      requestCount += 1;
      return 913;
    },
  });

  assert.equal(lessonId, 912);
  assert.equal(requestCount, 0);
});

test("shares one private lesson request between concurrent credit attempts", async () => {
  let requestCount = 0;
  let resolveRequest: ((lessonId: number) => void) | undefined;
  const request = createSingleFlightRequest(
    () =>
      new Promise<number>((resolve) => {
        requestCount += 1;
        resolveRequest = resolve;
      }),
  );

  const firstAttempt = request();
  const secondAttempt = request();
  resolveRequest?.(912);

  assert.equal(await firstAttempt, 912);
  assert.equal(await secondAttempt, 912);
  assert.equal(requestCount, 1);
});

test("permits a retry after a failed request", async () => {
  let requestCount = 0;
  const request = createSingleFlightRequest(async () => {
    requestCount += 1;
    if (requestCount === 1) {
      throw new Error("Missing lesson location details for this request.");
    }
    return 912;
  });

  await assert.rejects(request(), /Missing lesson location details/);
  assert.equal(await request(), 912);
  assert.equal(requestCount, 2);
});
