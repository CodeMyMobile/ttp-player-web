import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildAppRedirectUrl,
  buildCoachShareUrl,
  buildGroupLessonShareUrl,
  buildMatchShareUrl,
  buildSocialShareTargets,
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

test("builds channel URLs for social share buttons", () => {
  const targets = buildSocialShareTargets({
    title: "Adv. Beginner Liveball",
    text: "Join this class",
    url: "https://thetennisplan.com/s/group-lessons/2551",
  });

  assert.equal(
    targets.sms,
    "sms:?&body=Join%20this%20class%20https%3A%2F%2Fthetennisplan.com%2Fs%2Fgroup-lessons%2F2551",
  );
  assert.equal(
    targets.whatsapp,
    "https://wa.me/?text=Join%20this%20class%20https%3A%2F%2Fthetennisplan.com%2Fs%2Fgroup-lessons%2F2551",
  );
  assert.equal(
    targets.email,
    "mailto:?subject=Adv.%20Beginner%20Liveball&body=Join%20this%20class%20https%3A%2F%2Fthetennisplan.com%2Fs%2Fgroup-lessons%2F2551",
  );
});
