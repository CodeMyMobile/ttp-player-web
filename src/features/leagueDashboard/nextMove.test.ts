import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeNextMove,
  pickBestUnplayedOpponent,
  type NextMoveContext,
  type UnplayedOpponent,
} from "./nextMove.ts";

// A context where NOTHING matches until Rung 4 (exhausted). Each test overrides
// just the fields for the rung under test, so we know exactly what triggered it.
const baseCtx = (over: Partial<NextMoveContext> = {}): NextMoveContext => ({
  has_posted_availability: false,
  open_match_count: 0,
  matchmake_candidate: null,
  unscored_results: [],
  pending_challenges_for_me: [],
  unplayed_opponents: [],
  ...over,
});

const opp = (over: Partial<UnplayedOpponent> = {}): UnplayedOpponent => ({
  playerId: "x",
  name: "Test Opponent",
  ratingDelta: 0.5,
  lastActiveAt: "2026-07-01T00:00:00Z",
  ...over,
});

// ── Rung 0: close loops ───────────────────────────────────────────────────────
test("Rung 0a — an unscored result → report result (amber)", () => {
  const move = computeNextMove(
    baseCtx({ unscored_results: [{ matchId: 1, opponentName: "Ivan Hee", completedAt: "Jul 2" }] }),
  );
  assert.equal(move.rung, 0);
  assert.equal(move.kind, "report_result");
  assert.equal(move.tone, "amber");
  assert.equal(move.cta.target, "add-score");
  assert.match(move.body, /Ivan Hee/);
});

test("Rung 0b — a challenge awaiting my response → respond (amber)", () => {
  const move = computeNextMove(
    baseCtx({ pending_challenges_for_me: [{ challengeId: 9, fromName: "Danny Eide" }] }),
  );
  assert.equal(move.rung, 0);
  assert.equal(move.kind, "respond_challenge");
  assert.equal(move.tone, "amber");
  assert.equal(move.cta.target, "respond-challenge");
});

test("Rung 0 ordering — unscored result is chosen before a pending challenge", () => {
  const move = computeNextMove(
    baseCtx({
      unscored_results: [{ matchId: 1, opponentName: "Ivan Hee" }],
      pending_challenges_for_me: [{ challengeId: 9, fromName: "Danny Eide" }],
    }),
  );
  assert.equal(move.kind, "report_result");
});

// ── Rung 1: matched availability ──────────────────────────────────────────────
test("Rung 1 — posted availability + a candidate → schedule (violet)", () => {
  const move = computeNextMove(
    baseCtx({
      has_posted_availability: true,
      matchmake_candidate: { playerId: 2, name: "Peter Bergren", when: "Sat Jul 12 · 3 PM", distanceMiles: 4.2, ratingDelta: 0.5 },
    }),
  );
  assert.equal(move.rung, 1);
  assert.equal(move.kind, "schedule_candidate");
  assert.equal(move.tone, "violet");
  assert.equal(move.cta.target, "schedule-candidate");
  assert.equal(move.cta.label, "Schedule with Peter");
  assert.match(move.meta ?? "", /4.2 mi/);
  assert.match(move.meta ?? "", /rating gap \+0.5/);
});

test("Rung 1 does NOT fire without a candidate even if availability is posted", () => {
  const move = computeNextMove(baseCtx({ has_posted_availability: true, matchmake_candidate: null }));
  assert.notEqual(move.kind, "schedule_candidate");
});

// ── Rung 2: open pool, not posted ─────────────────────────────────────────────
test("Rung 2 — not posted + open matches exist → browse open (all-matches)", () => {
  const move = computeNextMove(baseCtx({ has_posted_availability: false, open_match_count: 12 }));
  assert.equal(move.rung, 2);
  assert.equal(move.kind, "browse_open");
  assert.equal(move.tone, "violet");
  assert.equal(move.cta.target, "all-matches");
  assert.match(move.title, /12 players have open times/);
});

// ── Rung 3a: 0 open, not posted → add availability ────────────────────────────
test("Rung 3a — 0 open matches + not posted → add your availability (violet)", () => {
  const move = computeNextMove(baseCtx({ open_match_count: 0, has_posted_availability: false }));
  assert.equal(move.rung, 3);
  assert.equal(move.kind, "add_availability");
  assert.equal(move.tone, "violet");
  assert.equal(move.cta.target, "add-availability");
});

// ── Rung 3b: 0 open, posted → challenge best unplayed opponent ────────────────
test("Rung 3b — 0 open + posted + unplayed opponents → direct challenge (violet)", () => {
  const move = computeNextMove(
    baseCtx({
      open_match_count: 0,
      has_posted_availability: true,
      unplayed_opponents: [opp({ name: "Danny Eide", ratingDelta: 0.3 })],
    }),
  );
  assert.equal(move.rung, 3);
  assert.equal(move.kind, "challenge_opponent");
  assert.equal(move.tone, "violet");
  assert.equal(move.cta.target, "direct-challenge");
  assert.equal(move.cta.label, "Challenge Danny");
});

test("Rung 3b picks the CLOSEST rating; ties broken by most recently active", () => {
  const chosen = pickBestUnplayedOpponent([
    opp({ name: "Far", ratingDelta: 1.5, lastActiveAt: "2026-07-03T00:00:00Z" }),
    opp({ name: "Close Stale", ratingDelta: 0.2, lastActiveAt: "2026-06-01T00:00:00Z" }),
    opp({ name: "Close Fresh", ratingDelta: -0.2, lastActiveAt: "2026-07-03T00:00:00Z" }),
  ]);
  assert.equal(chosen?.name, "Close Fresh"); // |0.2| ties with Close Stale, fresher wins
});

// ── Rung 4: exhausted ─────────────────────────────────────────────────────────
test("Rung 4 — 0 open + posted + no unplayed opponents → all caught up (gray)", () => {
  const move = computeNextMove(
    baseCtx({ open_match_count: 0, has_posted_availability: true, unplayed_opponents: [] }),
  );
  assert.equal(move.rung, 4);
  assert.equal(move.kind, "all_caught_up");
  assert.equal(move.tone, "gray");
  assert.equal(move.cta.target, "notify-me");
  assert.equal(move.ghost, true);
});

test("brand-new player (not posted, 0 open) → Rung 3a add availability, not Rung 4", () => {
  // Rung 4 only applies once you've posted AND exhausted opponents — a fresh
  // player with nothing should be nudged to seed the pool, not told they're done.
  assert.equal(computeNextMove(baseCtx()).kind, "add_availability");
});

// ── Ordering: Rung 0 beats every lower rung ───────────────────────────────────
test("Rung 0 beats all — even with a candidate, open pool, and unplayed opponents", () => {
  const move = computeNextMove(
    baseCtx({
      unscored_results: [{ matchId: 1, opponentName: "Ivan Hee" }],
      has_posted_availability: true,
      open_match_count: 12,
      matchmake_candidate: { playerId: 2, name: "Peter Bergren" },
      unplayed_opponents: [opp()],
    }),
  );
  assert.equal(move.rung, 0);
  assert.equal(move.kind, "report_result");
});

test("Rung 1 beats Rung 2 — posted+candidate wins over open pool", () => {
  const move = computeNextMove(
    baseCtx({
      has_posted_availability: true,
      matchmake_candidate: { playerId: 2, name: "Peter Bergren" },
      open_match_count: 12,
    }),
  );
  assert.equal(move.rung, 1);
});

// ── HARD RULE: never route to all-matches when open_match_count === 0 ─────────
test("HARD RULE — target is never 'all-matches' when open_match_count === 0", () => {
  const permutations: NextMoveContext[] = [
    baseCtx({ open_match_count: 0, has_posted_availability: false }),
    baseCtx({ open_match_count: 0, has_posted_availability: true }),
    baseCtx({ open_match_count: 0, has_posted_availability: true, unplayed_opponents: [opp()] }),
    baseCtx({ open_match_count: 0, unscored_results: [{ matchId: 1, opponentName: "X" }] }),
    baseCtx({ open_match_count: 0, has_posted_availability: true, matchmake_candidate: { playerId: 1, name: "Y" } }),
  ];
  for (const ctx of permutations) {
    assert.notEqual(computeNextMove(ctx).cta.target, "all-matches");
  }
});
