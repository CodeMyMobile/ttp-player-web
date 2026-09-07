import assert from "node:assert/strict";
import test from "node:test";

import { resolveComputedNtrp, resolvePlayerLevel, resolveSelfReportedLevel } from "./playerLevel";

/**
 * The exact shape observed on a real signed-in session (asatennisapp@gmail.com),
 * read out of localStorage in the browser. calculated_ntrp is absent from the user
 * object and present on two others — which is what two earlier attempts at this got
 * wrong, so it is pinned here.
 */
const REAL_SESSION = {
  authUser: { usta_rating: "3.5" },
  personalDetails: { calculated_ntrp: 4.5, usta_rating: "3.5" },
  loginResponse: { profile: { calculated_ntrp: 4.5, usta_rating: "3.5" } },
};

test("finds calculated_ntrp where it actually lives on a real session", () => {
  assert.equal(resolveComputedNtrp(REAL_SESSION), 4.5);
  assert.equal(resolvePlayerLevel(REAL_SESSION), 4.5);
});

test("the computed rating beats the self-declared one", () => {
  // The whole point: this player typed 3.5, the platform computed 4.5 from played
  // results, and match creation was posting them at 3.5.
  assert.equal(resolveSelfReportedLevel(REAL_SESSION), "3.5");
  assert.notEqual(resolvePlayerLevel(REAL_SESSION), "3.5");
});

test("each nesting the value has been seen at is checked", () => {
  const at = (sources: object) => resolveComputedNtrp(sources as never);
  assert.equal(at({ authUser: { calculated_ntrp: 4.0 } }), 4.0);
  assert.equal(at({ authUser: { profile: { calculated_ntrp: 4.0 } } }), 4.0);
  assert.equal(at({ personalDetails: { calculated_ntrp: 4.0 } }), 4.0);
  assert.equal(at({ loginResponse: { profile: { calculated_ntrp: 4.0 } } }), 4.0);
  assert.equal(at({ loginResponse: { calculated_ntrp: 4.0 } }), 4.0);
});

test("a player with no computed rating still gets their self-declared one", () => {
  // calculated_ntrp is null until rating_gender is set, which is most of the roster.
  const selfRated = {
    authUser: { usta_rating: "3.5" },
    personalDetails: { calculated_ntrp: null, usta_rating: "3.5" },
    loginResponse: { profile: { usta_rating: "3.5" } },
  };
  assert.equal(resolveComputedNtrp(selfRated), null);
  assert.equal(resolvePlayerLevel(selfRated), "3.5");
});

test("the survey answer is used when nothing better exists", () => {
  assert.equal(
    resolvePlayerLevel({ authUser: { skill_level: "Intermediate (NTRP 3.5)" } }),
    "Intermediate (NTRP 3.5)",
  );
});

test("a player with nothing resolves to empty, not undefined", () => {
  assert.equal(resolvePlayerLevel({}), "");
  assert.equal(resolvePlayerLevel({ authUser: null, personalDetails: null, loginResponse: null }), "");
});

test("empty string is treated as absent, but 0 is not", () => {
  // "" is what the old chain produced for "no level"; it must not win over a real one.
  assert.equal(resolvePlayerLevel({ authUser: { usta_rating: "" }, personalDetails: { calculated_ntrp: 4.5 } }), 4.5);
  // 0 is not a reachable calculated_ntrp (rating_equivalents clamps to 2.5) but if it
  // ever were, it is a value rather than a gap.
  assert.equal(resolveComputedNtrp({ authUser: { calculated_ntrp: 0 } }), 0);
});
