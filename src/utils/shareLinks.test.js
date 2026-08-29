import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildAppRedirectUrl,
  buildCoachShareUrl,
  buildGroupLessonShareUrl,
  buildMatchShareUrl,
  isIndexableShareType,
  parseSharePath,
  venueNameFromAddress,
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

test("venueNameFromAddress strips the street line from a formatted address", () => {
  // The live coach/26 value — the case that prompted this.
  assert.equal(
    venueNameFromAddress("Penmar Recreation Center 1341 Lake St, Venice, CA 90291, USA"),
    "Penmar Recreation Center",
  );
  assert.equal(
    venueNameFromAddress("Mar Vista Recreation Center 11430 Woodbine St, Los Angeles, CA 90066, USA"),
    "Mar Vista Recreation Center",
  );
});

test("venueNameFromAddress keeps numbers that belong to the venue name", () => {
  // Greedy match cuts at the LAST number, so the venue's own number survives.
  assert.equal(venueNameFromAddress("Court 16 Tennis 123 Main St, Los Angeles, CA"), "Court 16 Tennis");
  assert.equal(venueNameFromAddress("Club 24, Santa Monica, CA"), "Club 24");
});

test("venueNameFromAddress returns nothing for a bare street address", () => {
  // No venue name in front of the number: there is nothing safe to show at all.
  assert.equal(venueNameFromAddress("1341 Lake St, Venice, CA 90291, USA"), "");
  assert.equal(venueNameFromAddress("3084 Motor Ave, Los Angeles, CA"), "");
});

test("venueNameFromAddress leaves a plain venue name alone", () => {
  assert.equal(venueNameFromAddress("Penmar Recreation Center"), "Penmar Recreation Center");
  assert.equal(venueNameFromAddress("Riviera Tennis Club, Pacific Palisades, CA"), "Riviera Tennis Club");
});

test("venueNameFromAddress handles empty and non-string input", () => {
  assert.equal(venueNameFromAddress(""), "");
  assert.equal(venueNameFromAddress(null), "");
  assert.equal(venueNameFromAddress(undefined), "");
  assert.equal(venueNameFromAddress("   "), "");
});

test("only commercial shopfront share types are indexable", () => {
  assert.equal(isIndexableShareType("coach"), true);
  assert.equal(isIndexableShareType("group-lessons"), true);
  // Transient logistics about identifiable people: zero search value, non-zero disclosure.
  assert.equal(isIndexableShareType("match"), false);
});

test("share types are not indexable until someone decides they are", () => {
  // Allow-list, so a type added later is safe by default.
  assert.equal(isIndexableShareType("player"), false);
  assert.equal(isIndexableShareType("league"), false);
  assert.equal(isIndexableShareType(""), false);
  assert.equal(isIndexableShareType(undefined), false);
});
