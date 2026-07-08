import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildAppRedirectUrl,
  buildCoachShareUrl,
  buildGroupLessonShareUrl,
  buildMatchShareUrl,
  parseSharePath,
} from "./shareLinks.js";

test("builds real gateway share URLs for supported entities", () => {
  const options = { origin: "https://thetennisplan.com/" };

  assert.equal(
    buildGroupLessonShareUrl(2486, options),
    "https://thetennisplan.com/s/group-lessons/2486",
  );
  assert.equal(
    buildMatchShareUrl("42", options),
    "https://thetennisplan.com/s/match/42",
  );
  assert.equal(
    buildCoachShareUrl(12, options),
    "https://thetennisplan.com/s/coach/12",
  );
});

test("maps share types to existing hash app routes", () => {
  const options = { origin: "https://thetennisplan.com" };

  assert.equal(
    buildAppRedirectUrl("group-lessons", 2486, options),
    "https://thetennisplan.com/#/group-lessons/2486",
  );
  assert.equal(
    buildAppRedirectUrl("match", 42, options),
    "https://thetennisplan.com/#/matches/42",
  );
  assert.equal(
    buildAppRedirectUrl("coach", 12, options),
    "https://thetennisplan.com/#/coaches/12",
  );
});

test("parses valid share paths and rejects malformed ones", () => {
  assert.deepEqual(parseSharePath("/s/match/42"), {
    type: "match",
    id: "42",
  });
  assert.equal(parseSharePath("/matches/42"), null);
  assert.equal(parseSharePath("/s/team/42"), null);
  assert.equal(parseSharePath("/s/match/not-valid"), null);
});
