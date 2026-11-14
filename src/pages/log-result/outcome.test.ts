import test from "node:test";
import assert from "node:assert/strict";

import { deltaChip, formatRating, headline, placesChip, resultLine, scoreLine } from "./outcome";
import type { MatchOutcome } from "./data";

const outcome = (over: Partial<MatchOutcome> = {}): MatchOutcome => ({
  id: 77,
  status: "confirmed",
  context: "league",
  played_at: null,
  won: true,
  retired: false,
  sets: [{ you: 6, opp: 4, kind: "set" }, { you: 3, opp: 6, kind: "set" }, { you: 10, opp: 7, kind: "mtb" }],
  opponent: { id: 1, name: "Ana One" },
  rating: { before: 4.1, after: 4.18, delta: 0.08 },
  first_confirmed_result: false,
  league: null,
  ...over,
});

test("the result line reads from the viewer's side", () => {
  assert.equal(resultLine(outcome()), "W 6–4, 3–6, 10–7 vs Ana");
  assert.equal(resultLine(outcome({ won: false, sets: [{ you: 4, opp: 6, kind: "set" }, { you: 2, opp: 6, kind: "set" }] })), "L 4–6, 2–6 vs Ana");
  assert.equal(scoreLine({ sets: [], retired: true }), "by retirement");
});

test("a win is celebrated; a loss is neutral", () => {
  assert.equal(headline({ won: true }, "Sahil Mehta"), "Nice win, Sahil");
  assert.equal(headline({ won: false }, "Sahil Mehta"), "Good match, Sahil");
  assert.equal(headline({ won: true }, null), "Nice win");
});

test("rating change and places chips", () => {
  assert.equal(deltaChip(0.08), "+0.08");
  assert.equal(deltaChip(-0.051), "−0.05");
  assert.equal(deltaChip(0.001), "±0.00");
  assert.equal(deltaChip(null), null);
  assert.equal(placesChip(2), "↑ 2 places");
  assert.equal(placesChip(-1), "↓ 1 place");
  assert.equal(placesChip(0), null);
  assert.equal(formatRating(4.1), "4.10");
});
