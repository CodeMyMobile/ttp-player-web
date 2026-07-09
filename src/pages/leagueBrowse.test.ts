import assert from "node:assert/strict";
import test from "node:test";

import type { League } from "../api/leagues";
import type { PlayerPersonalDetails } from "../api/playerProfile";
import {
  filterAvailableLeagues,
  getLeagueCardVariant,
} from "./leagueBrowse";

const league = (overrides: Partial<League> = {}): League => ({
  id: 1,
  name: "Penmar Flex",
  gender: "mixed",
  status: "active",
  ...overrides,
});

const profile = (
  overrides: Partial<PlayerPersonalDetails> = {},
): PlayerPersonalDetails => ({
  gender: "male",
  date_of_birth: "1990-05-10",
  usta_rating: 3.5,
  ...overrides,
});

test("filterAvailableLeagues returns all leagues when the all filter is selected", () => {
  const leagues = [
    league({ id: 1, gender: "men", band_low: 3, band_high: 4 }),
    league({ id: 2, gender: "women", band_low: 4, band_high: 4.5 }),
  ];

  assert.deepEqual(filterAvailableLeagues(leagues, "all", profile()), leagues);
});

test("filterAvailableLeagues returns all leagues when the all-levels filter is selected", () => {
  const leagues = [
    league({ id: 1, gender: "men", band_low: 3, band_high: 4 }),
    league({ id: 2, gender: "women", band_low: 4, band_high: 4.5 }),
  ];

  assert.deepEqual(filterAvailableLeagues(leagues, "all-levels", profile()), leagues);
});

test("filterAvailableLeagues narrows leagues by men's gender filter", () => {
  const leagues = [
    league({ id: 1, gender: "men" }),
    league({ id: 2, gender: "women" }),
    league({ id: 3, gender: "mixed" }),
  ];

  assert.deepEqual(filterAvailableLeagues(leagues, "men", profile()), [leagues[0]]);
});

test("filterAvailableLeagues narrows leagues by women's gender filter", () => {
  const leagues = [
    league({ id: 1, gender: "men" }),
    league({ id: 2, gender: "women" }),
    league({ id: 3, gender: "mixed" }),
  ];

  assert.deepEqual(filterAvailableLeagues(leagues, "women", profile()), [leagues[1]]);
});

test("filterAvailableLeagues narrows leagues by mixed gender filter", () => {
  const leagues = [
    league({ id: 1, gender: "men" }),
    league({ id: 2, gender: "women" }),
    league({ id: 3, gender: "mixed" }),
  ];

  assert.deepEqual(filterAvailableLeagues(leagues, "mixed", profile()), [leagues[2]]);
});

test("filterAvailableLeagues excludes leagues with present eligibility mismatches from the for-you filter", () => {
  const leagues = [
    league({ id: 1, name: "Good fit", gender: "men", band_low: 3, band_high: 4 }),
    league({ id: 2, name: "Gender mismatch", gender: "women", band_low: 3, band_high: 4 }),
    league({ id: 3, name: "Level mismatch", gender: "mixed", band_low: 4, band_high: 4.5 }),
  ];

  assert.deepEqual(
    filterAvailableLeagues(leagues, "for-you", profile()),
    [leagues[0]],
  );
});

test("filterAvailableLeagues excludes leagues with an age mismatch from the for-you filter", () => {
  const leagues = [
    league({ id: 1, name: "Adult flex", gender: "men", band_low: 3, band_high: 4 }),
  ];

  assert.deepEqual(
    filterAvailableLeagues(
      leagues,
      "for-you",
      profile({
        date_of_birth: "2010-07-10",
      }),
    ),
    [],
  );
});

test("filterAvailableLeagues keeps leagues when required profile data is missing", () => {
  const leagues = [
    league({ id: 1, gender: "women", band_low: 4, band_high: 4.5 }),
  ];

  assert.deepEqual(
    filterAvailableLeagues(
      leagues,
      "for-you",
      profile({
        gender: null,
        date_of_birth: null,
        usta_rating: null,
      }),
    ),
    leagues,
  );
});

test("getLeagueCardVariant returns enrolled before full when membership exists", () => {
  assert.equal(
    getLeagueCardVariant(
      league({ membership_status: "active", is_full: true, spots_remaining: 0 }),
    ),
    "enrolled",
  );
});

test("getLeagueCardVariant returns full when the league has no open spots", () => {
  assert.equal(
    getLeagueCardVariant(
      league({ spots_filled: 12, spots_remaining: "0" }),
    ),
    "full",
  );
});

test("getLeagueCardVariant returns available for open public leagues", () => {
  assert.equal(
    getLeagueCardVariant(
      league({ spots_filled: 8, spots_remaining: 4, is_full: false }),
    ),
    "available",
  );
});
