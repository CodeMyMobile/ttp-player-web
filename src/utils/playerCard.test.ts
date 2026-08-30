import assert from "node:assert/strict";
import { test } from "node:test";

import {
  availabilitySentence,
  courtLine,
  courtName,
  initialsBackground,
  initialsForeground,
  matchVerdict,
  normalizeCourt,
} from "./playerCard";

/* verdict */

test("two confirmed ratings are stated plainly", () => {
  assert.deepEqual(matchVerdict("4.5", "4.5", true, true), { text: "Even match", tone: "even", hedged: false });
  assert.deepEqual(matchVerdict("4.0", "4.5", true, true), { text: "A step up", tone: "up", hedged: false });
  assert.deepEqual(matchVerdict("4.5", "3.5", true, true), { text: "A step down", tone: "down", hedged: false });
});

test("a self-rated VIEWER hedges even against a confirmed player", () => {
  // The comparison is only as good as the weaker side. Their own unchecked guess
  // about themselves is still a guess.
  assert.deepEqual(matchVerdict("4.0", "4.5", true, false), {
    text: "Likely a step up",
    tone: "up",
    hedged: true,
  });
});

test("a self-rated TARGET is hedged, never stated plainly", () => {
  // The verdict must not sound more certain than the rating behind it.
  assert.deepEqual(matchVerdict("4.0", "4.5", false, true), {
    text: "Likely a step up",
    tone: "up",
    hedged: true,
  });
  assert.deepEqual(matchVerdict("4.5", "4.5", false, true), {
    text: "Likely an even match",
    tone: "even",
    hedged: true,
  });
  assert.deepEqual(matchVerdict("4.5", "3.5", false, true), {
    text: "Likely a step down",
    tone: "down",
    hedged: true,
  });
});

test("the two confidence levels stay distinct", () => {
  // Losing the TPR rung must not flatten the verdict to one level.
  const confirmed = matchVerdict("4.0", "4.5", true, true);
  const selfRated = matchVerdict("4.0", "4.5", false, true);
  assert.notEqual(confirmed?.text, selfRated?.text);
  assert.equal(confirmed?.hedged, false);
  assert.equal(selfRated?.hedged, true);
});

test("an unknown viewer tier defaults to hedging, not to certainty", () => {
  // The parameter defaults to false on purpose: a caller that has not looked up the
  // viewer's tier must not get the confident wording by omission.
  assert.equal(matchVerdict("4.0", "4.5", true)?.hedged, true);
});

test("no verdict at all when either level is unusable", () => {
  assert.equal(matchVerdict(null, "4.5", true, true), null);
  assert.equal(matchVerdict("4.0", null, true, true), null);
  assert.equal(matchVerdict("Unknown", "4.5", true, true), null);
  assert.equal(matchVerdict("4.0", "Unknown", true, true), null);
});

test("labels that arithmetic cannot parse still resolve", () => {
  assert.equal(matchVerdict("NTRP 4.0", "NTRP 4.5", true, true)?.text, "A step up");
  assert.equal(matchVerdict("NTRP 4.5", "NTRP 4.5+", true, true)?.tone, "even");
});

/* court */

test("courtName drops a street address", () => {
  assert.equal(courtName("Penmar Recreation Center 1341 Lake St, Venice, CA"), "Penmar Recreation Center");
  assert.equal(courtName("Riviera Tennis Club"), "Riviera Tennis Club");
});

test("a shared court is said out loud", () => {
  const line = courtLine(["Penmar Recreation Center"], ["Penmar Recreation Center 1341 Lake St, Venice, CA"]);
  assert.deepEqual(line, { text: "Penmar Recreation Center — your court too", isShared: true });
});

test("an unshared court is stated without claiming a match", () => {
  assert.deepEqual(courtLine(["Penmar Recreation Center"], ["Cheviot Hills Tennis Center"]), {
    text: "Plays at Cheviot Hills Tennis Center",
    isShared: false,
  });
});

test("court matching is case and whitespace insensitive", () => {
  assert.equal(courtLine(["  penmar recreation center "], ["Penmar Recreation Center"])?.isShared, true);
});

test("no courts means no line rather than an empty one", () => {
  assert.equal(courtLine(["Penmar"], []), null);
  assert.equal(courtLine(["Penmar"], null), null);
});

test("the obvious suffix variants of one venue are collapsed", () => {
  // sameCourt is the heaviest weight in the ranking and sits on the fuzziest data we
  // have, so the floor is raised by normalising before comparing. These are the same
  // public court written three ways.
  for (const theirs of ["Penmar Rec Center", "Penmar Rec", "PENMAR RECREATION CENTER"]) {
    assert.equal(
      courtLine(["Penmar Recreation Center"], [theirs])?.isShared,
      true,
      `${theirs} should match`,
    );
  }
  assert.equal(
    courtLine(["Cheviot Hills Recreation Center"], ["Cheviot Hills Tennis Center"])?.isShared,
    true,
  );
});

test("normalisation strips venue nouns, not the identifying word", () => {
  assert.equal(normalizeCourt("Penmar Recreation Center"), "penmar");
  assert.equal(normalizeCourt("Riviera Tennis Club"), "riviera");
  assert.equal(normalizeCourt("  Stoner   Park  "), "stoner");
});

test("it is still a floor: genuinely different venues do not match", () => {
  // Raising the floor must not become over-matching. Different names stay different.
  assert.equal(courtLine(["Penmar Recreation Center"], ["Stoner Park"])?.isShared, false);
  assert.equal(courtLine(["Riviera Tennis Club"], ["Palisades Tennis Center"])?.isShared, false);
});

/* availability */

test("availability reads as a sentence about both people", () => {
  assert.equal(
    availabilitySentence(["Weekdays AM", "Weekends"], ["Weekdays AM", "Weekends"]),
    "You're both free weekdays am and weekends",
  );
  assert.equal(availabilitySentence(["Weekends"], ["Weekends"]), "You're both free weekends");
});

test("three or more overlaps read naturally", () => {
  assert.equal(
    availabilitySentence(["Weekdays AM", "Weekday PM", "Weekends"], ["Weekdays AM", "Weekday PM", "Weekends"]),
    "You're both free weekdays am, weekday pm and weekends",
  );
});

test("no overlap still shows their times rather than nothing", () => {
  // The ranking claims shared times matter, so the card has to show times either way —
  // otherwise it asserts a basis it never displays.
  assert.equal(availabilitySentence(["Weekdays AM"], ["Weekends"]), "Free weekends");
  assert.equal(availabilitySentence([], ["Weekends"]), "Free weekends");
});

test("the line collapses only when there are no times at all", () => {
  assert.equal(availabilitySentence(null, null), null);
  assert.equal(availabilitySentence(["Weekdays AM"], []), null);
});

test("a street address never reaches the card", () => {
  // The endpoint returns whatever the AddressPicker stored. Rendering it would publish
  // a member's own address to every other member.
  assert.equal(courtName("3084 Motor Ave, Los Angeles, CA 90034, USA"), "Los Angeles");
  assert.equal(courtLine([], ["3084 Motor Ave, Los Angeles, CA 90034, USA"])?.text, "Plays at Los Angeles");
  assert.doesNotMatch(courtName("3084 Motor Ave, Los Angeles, CA"), /Motor Ave|3084/);
});

/* initials */

test("the initials tile is monochrome, not a per-name colour", () => {
  // A name-derived hue reads as a colour code that encodes nothing, and collides with
  // the semantic colours in the verdict chip beside it.
  assert.equal(initialsBackground(), "var(--fc-color-accent-light)");
  assert.equal(initialsForeground(), "var(--fc-color-accent-ink)");
});

test("the tile uses palette tokens rather than literal colour", () => {
  // accent-ink, not accent: these are small letters and the fill purple fails AA.
  assert.match(initialsForeground(), /accent-ink/);
  assert.doesNotMatch(initialsForeground(), /#/);
});
