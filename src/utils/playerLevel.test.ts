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

// --- the creator's user object -------------------------------------------------

import { buildLevelAwareUser } from "./playerLevel";

const PD = { id: 6, calculated_ntrp: 4.5, usta_rating: "3.5" };
const LR = { profile: { id: 6, calculated_ntrp: 4.5, usta_rating: "3.5" } };

test("the creator gets a level even when localStorage 'user' is missing or empty", () => {
  // Requiring "user" was the fourth thing that broke this: absent or {} left the
  // creator with no level and no host id, and it asked the player to add one.
  for (const authUser of [null, undefined, {}]) {
    const u = buildLevelAwareUser({ authUser, personalDetails: PD, loginResponse: LR });
    assert.equal(u?.skillLevel, 4.5, `authUser=${JSON.stringify(authUser)}`);
    assert.equal(u?.profile?.id, 6);
  }
});

test("the login response alone is enough", () => {
  const u = buildLevelAwareUser({ loginResponse: LR });
  assert.equal(u?.skillLevel, 4.5);
  assert.equal(u?.profile?.id, 6);
});

test("authUser still wins where it has a value", () => {
  const u = buildLevelAwareUser({
    authUser: { id: 99, usta_rating: "3.5" },
    personalDetails: PD,
    loginResponse: LR,
  });
  assert.equal(u?.id, 99);          // not overwritten by the other stores
  assert.equal(u?.skillLevel, 4.5); // but the computed level still comes through
});

test("nothing stored resolves to null rather than an empty object", () => {
  assert.equal(buildLevelAwareUser({}), null);
  assert.equal(buildLevelAwareUser({ authUser: null, personalDetails: null, loginResponse: null }), null);
});
