import test from "node:test";
import assert from "node:assert/strict";

import {
  choicesFromWindows,
  courtChips,
  fixtureAgainst,
  formatProposedTime,
  initialSelection,
  localInputToIso,
  proposalRows,
  timesToSend,
  windowLabel,
} from "./leagueArrange";

const TZ = "America/Los_Angeles";
const window = (start: string, end: string) => ({ start, end, date: "", weekday: 0, bucket: "evening" as const });

test("times and windows read in the viewer's timezone", () => {
  assert.equal(formatProposedTime("2026-11-15T17:00:00.000Z", TZ), "Sun, Nov 15 · 9:00 AM");
  assert.equal(windowLabel(window("2026-11-18T02:00:00.000Z", "2026-11-18T05:00:00.000Z"), TZ), "Both free 6pm–9pm");
});

test("suggestions come from the shared windows, soonest first, the first three ticked", () => {
  const choices = choicesFromWindows([
    window("2026-11-18T02:00:00.000Z", "2026-11-18T05:00:00.000Z"),
    window("2026-11-15T17:00:00.000Z", "2026-11-15T20:00:00.000Z"),
    window("2026-11-16T17:00:00.000Z", "2026-11-16T20:00:00.000Z"),
    window("2026-11-19T02:00:00.000Z", "2026-11-19T05:00:00.000Z"),
  ]);
  assert.deepEqual(choices.map((c) => c.start.slice(0, 10)), ["2026-11-15", "2026-11-16", "2026-11-18", "2026-11-19"]);
  assert.deepEqual([...initialSelection(choices)], [choices[0].key, choices[1].key, choices[2].key]);
});

test("only ticked, future, distinct times are sent, soonest first", () => {
  const choices = [
    { key: "b", start: "2026-11-16T17:00:00.000Z" },
    { key: "a", start: "2026-11-15T17:00:00.000Z" },
    { key: "past", start: "2026-11-01T17:00:00.000Z" },
    { key: "dup", start: "2026-11-15T17:00:00Z" },
  ];
  assert.deepEqual(timesToSend(choices, new Set(["a", "b", "past", "dup"]), new Date("2026-11-14T00:00:00Z")), [
    "2026-11-15T17:00:00.000Z",
    "2026-11-16T17:00:00.000Z",
  ]);
});

test("a typed time becomes an instant; anything else is refused", () => {
  assert.ok(localInputToIso("2026-11-15T18:30"));
  assert.equal(localInputToIso("tomorrow"), null);
});

test("the fixture against an opponent is the unplayed one", () => {
  const fixtures = [
    { id: 1, league_id: 4, player1_id: 10, player2_id: 20, status: "confirmed", score: "6-4 6-3" },
    { id: 2, league_id: 4, player1_id: 30, player2_id: 10, status: "scheduled", score: null },
  ];
  assert.equal(fixtureAgainst(fixtures, 20), null);
  assert.equal(fixtureAgainst(fixtures, "30")?.id, 2);
});

test("proposal rows: waiting on them, or theirs to pick; picked ones are left to Scheduled", () => {
  const base = { league_id: 4, status: "scheduled" };
  const rows = proposalRows(
    [
      { ...base, id: 1, player1_id: 10, player2_id: 20, player2_name: "Deepak", scheduled_match: { id: 900, host_id: 10, status: "open", picked: false, start_date_time: "", proposed_times: ["t1", "t2"], location_text: "Riverside" } },
      { ...base, id: 2, player1_id: 30, player2_id: 10, player1_name: "Ana", scheduled_match: { id: 901, host_id: 30, status: "open", picked: false, start_date_time: "", proposed_times: ["t3"] } },
      { ...base, id: 3, player1_id: 10, player2_id: 40, scheduled_match: { id: 902, host_id: 10, status: "confirmed", picked: true, start_date_time: "", proposed_times: [] } },
      { ...base, id: 4, player1_id: 10, player2_id: 50, scheduled_match: null },
    ],
    10,
  );
  assert.deepEqual(
    rows.map((row) => [row.fixtureId, row.opponentId, row.opponentName, row.sentByViewer, row.times.length]),
    [
      ["1", "20", "Deepak", true, 2],
      ["2", "30", "Ana", false, 1],
    ],
  );
});

test("court chips: shared courts first, then the opponent's, then yours, four at most", () => {
  const court = (id: number) => ({ id, name: `Court ${id}`, area: null, latitude: null, longitude: null, matches_played: 1 });
  const chips = courtChips([court(1), court(2), court(5), court(6)], [court(2), court(3), court(4)], "Ana");
  assert.deepEqual(
    chips.map((c) => [c.id, c.note]),
    [
      ["2", "You both play here"],
      ["3", "Ana plays here"],
      ["4", "Ana plays here"],
      ["1", "You play here"],
    ],
  );
  assert.deepEqual(courtChips([], [], "Ana"), []);
});
