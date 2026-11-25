import test from "node:test";
import assert from "node:assert/strict";

import type { PlayoffBracket, PlayoffMatch } from "../api/leagues";
import { fixturesInStage } from "../api/leagues";
import {
  championName,
  feederLabel,
  isPlayable,
  playoffShortLabel,
  playoffSide,
  viewerPlayoffState,
} from "./leaguePlayoffs";

const match = (over: Partial<PlayoffMatch>): PlayoffMatch => ({
  id: 1,
  playoff_round: 1,
  bracket_slot: 1,
  player1_id: null,
  player2_id: null,
  seed1: null,
  seed2: null,
  status: "scheduled",
  winner_id: null,
  ...over,
});

const bracket = (matches: PlayoffMatch[], champion_id: number | null = null): PlayoffBracket => ({
  started_at: "2026-11-25T00:00:00Z",
  champion_id,
  completed_at: null,
  rounds: [1, 2, 3].map((round) => ({
    round,
    name: "",
    matches: matches.filter((row) => row.playoff_round === round),
  })),
});

test("labels and feeders follow the bracket: slot s feeds slot ceil(s/2), odd slots as player 1", () => {
  assert.equal(playoffShortLabel({ playoff_round: 1, bracket_slot: 3 }), "QF 3");
  assert.equal(playoffShortLabel({ playoff_round: 3, bracket_slot: 1 }), "Final");
  assert.equal(feederLabel({ playoff_round: 2, bracket_slot: 1 }, 1), "Winner of QF 1");
  assert.equal(feederLabel({ playoff_round: 2, bracket_slot: 2 }, 2), "Winner of QF 4");
  assert.equal(feederLabel({ playoff_round: 3, bracket_slot: 1 }, 2), "Winner of SF 2");
  assert.equal(feederLabel({ playoff_round: 1, bracket_slot: 1 }, 1), null);
});

test("a side is the seeded player, a bye, or the match it waits on", () => {
  assert.deepEqual(
    playoffSide(match({ player1_id: 7, player1_name: "Ana", seed1: 1, winner_id: 7 }), 1),
    { playerId: "7", name: "Ana", seed: 1, won: true, placeholder: false },
  );
  assert.equal(playoffSide(match({ status: "bye", player1_id: 7 }), 2).name, "Bye");
  assert.equal(playoffSide(match({ playoff_round: 2, bracket_slot: 1 }), 2).name, "Winner of QF 2");
});

test("playable once both players are known and nothing is decided", () => {
  assert.equal(isPlayable(match({ player1_id: 1, player2_id: 2 })), true);
  assert.equal(isPlayable(match({ player1_id: 1 })), false);
  assert.equal(isPlayable(match({ player1_id: 1, player2_id: 2, status: "walkover", winner_id: 1 })), false);
});

test("the viewer's state: play, score sent, waiting, out, champion, none", () => {
  const qf = match({ id: 1, player1_id: 1, player1_name: "Ana", seed1: 1, player2_id: 8, player2_name: "Hal", seed2: 8 });
  assert.equal(viewerPlayoffState(bracket([qf]), "8").kind, "play");
  const play = viewerPlayoffState(bracket([qf]), "1");
  assert.equal(play.kind === "play" && play.opponent.name, "Hal");
  assert.equal(play.kind === "play" && play.round, "Quarter-final");

  assert.equal(viewerPlayoffState(bracket([{ ...qf, status: "pending_confirmation" }]), "1").kind, "score-sent");

  const won = { ...qf, status: "confirmed", winner_id: 1 };
  const sf = match({ id: 5, playoff_round: 2, bracket_slot: 1, player1_id: 1, player1_name: "Ana", seed1: 1 });
  const waiting = viewerPlayoffState(bracket([won, sf]), "1");
  assert.equal(waiting.kind, "waiting");
  assert.equal(waiting.kind === "waiting" && waiting.waitingFor, "Winner of QF 2");

  const out = viewerPlayoffState(bracket([won, sf]), "8");
  assert.deepEqual(out, { kind: "out", round: "Quarter-final" });

  assert.equal(viewerPlayoffState(bracket([won], 1), "1").kind, "champion");
  assert.equal(viewerPlayoffState(bracket([won]), "99").kind, "none");
  assert.equal(viewerPlayoffState(null, "1").kind, "none");
});

test("champion name comes from the final", () => {
  const final = match({ playoff_round: 3, player1_id: 1, player1_name: "Ana", player2_id: 2, player2_name: "Bea", winner_id: 2, status: "confirmed" });
  assert.equal(championName(bracket([final], 2)), "Bea");
  assert.equal(championName(bracket([final])), null);
});

test("fixtures default to the regular season", () => {
  const rows = [
    { id: 1, league_id: 1 },
    { id: 2, league_id: 1, stage: "regular" },
    { id: 3, league_id: 1, stage: "playoff" },
  ];
  assert.deepEqual(fixturesInStage(rows, "regular").map((row) => row.id), [1, 2]);
  assert.deepEqual(fixturesInStage(rows, "playoff").map((row) => row.id), [3]);
  assert.equal(fixturesInStage(rows, "all").length, 3);
});
