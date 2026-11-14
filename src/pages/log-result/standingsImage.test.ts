import test from "node:test";
import assert from "node:assert/strict";

import { standingsImageRows } from "./standingsImage";

const row = (rank: number, player_id: number) => ({
  rank,
  player_id,
  full_name: `P${player_id}`,
  matches_played: 0,
  wins: rank,
  losses: 1,
  games_for: 0,
  games_against: 0,
  game_differential: 0,
});

test("top rows in rank order, the viewer marked", () => {
  const rows = standingsImageRows([row(2, 20), row(1, 10), row(3, 30)], 20);
  assert.deepEqual(rows.map((r) => [r.rank, r.name, r.record, r.you]), [
    [1, "P10", "1–1", false],
    [2, "P20", "2–1", true],
    [3, "P30", "3–1", false],
  ]);
});

test("a viewer below the cut keeps their row in place of the last", () => {
  const standings = Array.from({ length: 12 }, (_, i) => row(i + 1, i + 1));
  const rows = standingsImageRows(standings, 12, 10);
  assert.equal(rows.length, 10);
  assert.deepEqual(rows[9], { rank: 12, name: "P12", record: "12–1", you: true });
  assert.equal(rows[8].rank, 9);
});
