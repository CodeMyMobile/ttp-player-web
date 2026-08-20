import assert from "node:assert/strict";
import test from "node:test";

import { hoursUntilFloating, parseFloatingLocal } from "./floatingTime";

// Local, so the assertions hold in any timezone the suite runs in.
const localNoon = new Date(2026, 7, 21, 12, 0, 0);

test("the Z is ignored, because it is not a real instant", () => {
  // The whole point: "19:00Z" means seven in the evening at the venue, so it
  // must read as 19:00 local, not as 19:00 UTC.
  const parsed = parseFloatingLocal("2026-08-21T19:00:00Z");

  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 7);
  assert.equal(parsed.getDate(), 21);
  assert.equal(parsed.getHours(), 19);
  assert.equal(parsed.getMinutes(), 0);
});

test("the same digits parse the same however they are punctuated", () => {
  const forms = [
    "2026-08-21T19:00:00Z",
    "2026-08-21T19:00:00",
    "2026-08-21 19:00:00",
    "2026-08-21T19:00",
    "2026-08-21T19:00:00.000Z",
    "2026-08-21T19:00:00+05:00",
  ];
  const hours = forms.map((f) => parseFloatingLocal(f)?.getHours());

  assert.deepEqual(hours, [19, 19, 19, 19, 19, 19]);
});

test("hours remaining are measured against the wall clock, not a shifted one", () => {
  // The regression: moment.utc(start).diff(moment.utc()) reported 2 hours here,
  // short by the venue's offset, and closed the cancellation window early.
  const hours = hoursUntilFloating("2026-08-21T19:00:00Z", localNoon.getTime());

  assert.equal(hours, 7);
});

test("a player 25 hours out is still inside a 24-hour window", () => {
  const now = new Date(2026, 7, 20, 18, 0, 0).getTime();
  const hours = hoursUntilFloating("2026-08-21T19:00:00Z", now);

  assert.equal(hours, 25);
  assert.ok(hours >= 24, "must not read as closed");
});

test("a class already past reads as negative, not as far away", () => {
  const now = new Date(2026, 7, 21, 20, 0, 0).getTime();

  assert.equal(hoursUntilFloating("2026-08-21T19:00:00Z", now), -1);
});

test("an unreadable value is null, never a number", () => {
  // Callers must be able to tell "we do not know" from "no time left" — closing
  // the window on a guess costs a player a refund they are entitled to.
  for (const bad of [null, undefined, "", "   ", "not-a-date", 42, {}, "2026-08"]) {
    assert.equal(parseFloatingLocal(bad), null);
    assert.equal(hoursUntilFloating(bad), null);
  }
});
