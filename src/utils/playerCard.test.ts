import assert from "node:assert/strict";
import { test } from "node:test";

import {
  availabilitySentence,
  courtLine,
  courtName,
  initialsBackground,
  initialsHue,
  matchVerdict,
} from "./playerCard";

/* verdict */

test("a confirmed rating is stated plainly", () => {
  assert.deepEqual(matchVerdict("4.5", "4.5", true), { text: "Even match", tone: "even", hedged: false });
  assert.deepEqual(matchVerdict("4.0", "4.5", true), { text: "A step up", tone: "up", hedged: false });
  assert.deepEqual(matchVerdict("4.5", "3.5", true), { text: "A step down", tone: "down", hedged: false });
});

test("a self-rated rating is hedged, never stated plainly", () => {
  // The verdict must not sound more certain than the rating behind it.
  assert.deepEqual(matchVerdict("4.0", "4.5", false), {
    text: "Likely a step up",
    tone: "up",
    hedged: true,
  });
  assert.deepEqual(matchVerdict("4.5", "4.5", false), {
    text: "Likely an even match",
    tone: "even",
    hedged: true,
  });
  assert.deepEqual(matchVerdict("4.5", "3.5", false), {
    text: "Likely a step down",
    tone: "down",
    hedged: true,
  });
});

test("the two confidence levels stay distinct", () => {
  // Losing the TPR rung must not flatten the verdict to one level.
  const confirmed = matchVerdict("4.0", "4.5", true);
  const selfRated = matchVerdict("4.0", "4.5", false);
  assert.notEqual(confirmed?.text, selfRated?.text);
  assert.equal(confirmed?.hedged, false);
  assert.equal(selfRated?.hedged, true);
});

test("no verdict at all when either level is unusable", () => {
  assert.equal(matchVerdict(null, "4.5", true), null);
  assert.equal(matchVerdict("4.0", null, true), null);
  assert.equal(matchVerdict("Unknown", "4.5", true), null);
  assert.equal(matchVerdict("4.0", "Unknown", true), null);
});

test("labels that arithmetic cannot parse still resolve", () => {
  assert.equal(matchVerdict("NTRP 4.0", "NTRP 4.5", true)?.text, "A step up");
  assert.equal(matchVerdict("NTRP 4.5", "NTRP 4.5+", true)?.tone, "even");
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

test("label matching under-reports rather than over-reports", () => {
  // Known limitation: no venue IDs. A near-miss must be a false NEGATIVE.
  assert.equal(
    courtLine(["Cheviot Hills Recreation Center"], ["Cheviot Hills Tennis Center"])?.isShared,
    false,
  );
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

test("no overlap collapses the line instead of announcing it", () => {
  assert.equal(availabilitySentence(["Weekdays AM"], ["Weekends"]), null);
  assert.equal(availabilitySentence([], ["Weekends"]), null);
  assert.equal(availabilitySentence(null, null), null);
});

/* initials */

test("a name always gets the same colour", () => {
  assert.equal(initialsHue("Ada Lovelace"), initialsHue("Ada Lovelace"));
  assert.equal(initialsHue("ada lovelace"), initialsHue("  Ada Lovelace  "));
});

test("different names generally differ", () => {
  const hues = ["Ada Lovelace", "Grace Hopper", "Alan Turing", "Katherine Johnson"].map(initialsHue);
  assert.ok(new Set(hues).size >= 3, "hues should spread across a list of names");
});

test("the colour stays inside the muted band", () => {
  // Free rein on hue, but saturation and lightness are pinned so tiles sit inside the
  // warm palette rather than fighting it.
  for (const name of ["Ada Lovelace", "Grace Hopper", ""]) {
    assert.match(initialsBackground(name), /^hsl\(\d+ 40% 58%\)$/);
  }
});
