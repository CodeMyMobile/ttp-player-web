import assert from "node:assert/strict";
import test from "node:test";

import type { LeagueGender } from "../../api/leagues";
import type { PlayerGender } from "../../api/playerProfile";
import { evaluateLeagueEligibility } from "./eligibility";
import type {
  LeagueJoinEligibility,
  LeagueJoinEligibilityStatus,
  LeagueJoinLeague,
  LeagueJoinPending,
  LeagueJoinProfile,
} from "./types";

type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2)
    ? true
    : false;
type Expect<T extends true> = T;

type _leagueGenderExact = Expect<IsEqual<LeagueGender, "men" | "women" | "mixed">>;
type _playerGenderExact = Expect<IsEqual<PlayerGender, "male" | "female" | "other">>;
type _eligibilityStatusExact = Expect<
  IsEqual<LeagueJoinEligibilityStatus, "pass" | "missing" | "entered_mismatch" | "existing_mismatch">
>;

const now = new Date("2026-07-09T12:00:00.000Z");

const baseLeague = (overrides: Partial<LeagueJoinLeague> = {}): LeagueJoinLeague => ({
  gender: "men",
  bandLow: 3,
  bandHigh: 4,
  ...overrides,
});

const baseProfile = (overrides: Partial<LeagueJoinProfile> = {}): LeagueJoinProfile => ({
  gender: "male",
  level: 3.5,
  dateOfBirth: "2000-07-09",
  ...overrides,
});

const basePending = (overrides: Partial<LeagueJoinPending> = {}): LeagueJoinPending => ({
  ...overrides,
});

const assertEligibility = (
  result: LeagueJoinEligibility,
  expected: {
    gender: LeagueJoinEligibilityStatus;
    level: LeagueJoinEligibilityStatus;
    age: LeagueJoinEligibilityStatus;
    canContinue: boolean;
  },
) => {
  assert.equal(result.gender.status, expected.gender);
  assert.equal(result.level.status, expected.level);
  assert.equal(result.age.status, expected.age);
  assert.equal(result.canContinue, expected.canContinue);
};

test("eligible player passes every check", () => {
  const result = evaluateLeagueEligibility({
    league: baseLeague(),
    profile: baseProfile(),
    pending: basePending(),
    now,
  });

  assertEligibility(result, {
    gender: "pass",
    level: "pass",
    age: "pass",
    canContinue: true,
  });
});

test("league level bounds are inclusive at both ends", () => {
  const lowEdge = evaluateLeagueEligibility({
    league: baseLeague({ bandLow: 3, bandHigh: 4 }),
    profile: baseProfile({ level: 3 }),
    pending: basePending(),
    now,
  });
  const highEdge = evaluateLeagueEligibility({
    league: baseLeague({ bandLow: 3, bandHigh: 4 }),
    profile: baseProfile({ level: 4 }),
    pending: basePending(),
    now,
  });

  assert.equal(lowEdge.level.status, "pass");
  assert.equal(highEdge.level.status, "pass");
});

test("API-shaped league and profile fields are accepted", () => {
  const result = evaluateLeagueEligibility({
    league: {
      gender: "mixed",
      band_low: 3,
      band_high: 4,
    } as LeagueJoinLeague,
    profile: {
      gender: "other",
      date_of_birth: "2000-07-09",
      usta_rating: 3.5,
    } as LeagueJoinProfile,
    pending: {
      gender: "other",
      date_of_birth: "2000-07-09",
      usta_rating: 3.5,
    } as LeagueJoinPending,
    now,
  });

  assertEligibility(result, {
    gender: "pass",
    level: "pass",
    age: "pass",
    canContinue: true,
  });
});

test("missing fields are reported as missing when neither profile nor pending provides them", () => {
  const missingGender = evaluateLeagueEligibility({
    league: baseLeague(),
    profile: baseProfile({ gender: undefined }),
    pending: basePending(),
    now,
  });
  const missingLevel = evaluateLeagueEligibility({
    league: baseLeague(),
    profile: baseProfile({ level: undefined }),
    pending: basePending(),
    now,
  });
  const missingAge = evaluateLeagueEligibility({
    league: baseLeague(),
    profile: baseProfile({ dateOfBirth: undefined }),
    pending: basePending(),
    now,
  });

  assert.equal(missingGender.gender.status, "missing");
  assert.equal(missingLevel.level.status, "missing");
  assert.equal(missingAge.age.status, "missing");
});

test("all missing leaves every dimension blocked", () => {
  const result = evaluateLeagueEligibility({
    league: baseLeague(),
    profile: {},
    pending: {},
    now,
  });

  assertEligibility(result, {
    gender: "missing",
    level: "missing",
    age: "missing",
    canContinue: false,
  });
});

test("entered mismatches are reported from pending values", () => {
  const gender = evaluateLeagueEligibility({
    league: baseLeague({ gender: "women" }),
    profile: baseProfile({ gender: undefined }),
    pending: basePending({ gender: "male" }),
    now,
  });
  const level = evaluateLeagueEligibility({
    league: baseLeague({ bandLow: 3, bandHigh: 4 }),
    profile: baseProfile({ level: undefined }),
    pending: basePending({ level: 4.5 }),
    now,
  });
  const age = evaluateLeagueEligibility({
    league: baseLeague(),
    profile: baseProfile({ dateOfBirth: undefined }),
    pending: basePending({ dateOfBirth: "2008-07-10" }),
    now,
  });

  assert.equal(gender.gender.status, "entered_mismatch");
  assert.equal(level.level.status, "entered_mismatch");
  assert.equal(age.age.status, "entered_mismatch");
});

test("existing mismatches are reported from stored profile values", () => {
  const gender = evaluateLeagueEligibility({
    league: baseLeague({ gender: "women" }),
    profile: baseProfile({ gender: "male" }),
    pending: basePending(),
    now,
  });
  const level = evaluateLeagueEligibility({
    league: baseLeague({ bandLow: 3, bandHigh: 4 }),
    profile: baseProfile({ level: 4.5 }),
    pending: basePending(),
    now,
  });
  const age = evaluateLeagueEligibility({
    league: baseLeague(),
    profile: baseProfile({ dateOfBirth: "2008-07-10" }),
    pending: basePending(),
    now,
  });

  assert.equal(gender.gender.status, "existing_mismatch");
  assert.equal(level.level.status, "existing_mismatch");
  assert.equal(age.age.status, "existing_mismatch");
});

test("pending gender overrides stored gender in both directions", () => {
  const corrected = evaluateLeagueEligibility({
    league: baseLeague({ gender: "women" }),
    profile: baseProfile({ gender: "male" }),
    pending: basePending({ gender: "female" }),
    now,
  });
  const newlyInvalid = evaluateLeagueEligibility({
    league: baseLeague({ gender: "men" }),
    profile: baseProfile({ gender: "male" }),
    pending: basePending({ gender: "female" }),
    now,
  });

  assertEligibility(corrected, {
    gender: "pass",
    level: "pass",
    age: "pass",
    canContinue: true,
  });
  assert.equal(newlyInvalid.gender.status, "entered_mismatch");
  assert.equal(newlyInvalid.canContinue, false);
});

test("pending level overrides stored level in both directions", () => {
  const corrected = evaluateLeagueEligibility({
    league: baseLeague({ bandLow: 3, bandHigh: 4 }),
    profile: baseProfile({ level: 4.5 }),
    pending: basePending({ level: 3.5 }),
    now,
  });
  const newlyInvalid = evaluateLeagueEligibility({
    league: baseLeague({ bandLow: 3, bandHigh: 4 }),
    profile: baseProfile({ level: 3.5 }),
    pending: basePending({ level: 4.5 }),
    now,
  });

  assertEligibility(corrected, {
    gender: "pass",
    level: "pass",
    age: "pass",
    canContinue: true,
  });
  assert.equal(newlyInvalid.level.status, "entered_mismatch");
  assert.equal(newlyInvalid.canContinue, false);
});

test("pending date of birth overrides stored date of birth in both directions", () => {
  const corrected = evaluateLeagueEligibility({
    league: baseLeague(),
    profile: baseProfile({ dateOfBirth: "2008-07-10" }),
    pending: basePending({ dateOfBirth: "2008-07-09" }),
    now,
  });
  const newlyInvalid = evaluateLeagueEligibility({
    league: baseLeague(),
    profile: baseProfile({ dateOfBirth: "2008-07-09" }),
    pending: basePending({ dateOfBirth: "2008-07-10" }),
    now,
  });

  assertEligibility(corrected, {
    gender: "pass",
    level: "pass",
    age: "pass",
    canContinue: true,
  });
  assert.equal(newlyInvalid.age.status, "entered_mismatch");
  assert.equal(newlyInvalid.canContinue, false);
});

test("exactly 18 years old passes while under 18 fails", () => {
  const exact = evaluateLeagueEligibility({
    league: baseLeague(),
    profile: baseProfile({ dateOfBirth: "2008-07-09" }),
    pending: basePending(),
    now,
  });
  const under = evaluateLeagueEligibility({
    league: baseLeague(),
    profile: baseProfile({ dateOfBirth: "2008-07-10" }),
    pending: basePending(),
    now,
  });

  assert.equal(exact.age.status, "pass");
  assert.equal(under.age.status, "existing_mismatch");
});

test("other only qualifies for mixed leagues", () => {
  const mixed = evaluateLeagueEligibility({
    league: baseLeague({ gender: "mixed" }),
    profile: baseProfile({ gender: undefined }),
    pending: basePending({ gender: "other" }),
    now,
  });
  const men = evaluateLeagueEligibility({
    league: baseLeague({ gender: "men" }),
    profile: baseProfile({ gender: undefined }),
    pending: basePending({ gender: "other" }),
    now,
  });
  const women = evaluateLeagueEligibility({
    league: baseLeague({ gender: "women" }),
    profile: baseProfile({ gender: undefined }),
    pending: basePending({ gender: "other" }),
    now,
  });

  assert.equal(mixed.gender.status, "pass");
  assert.equal(men.gender.status, "entered_mismatch");
  assert.equal(women.gender.status, "entered_mismatch");
});
