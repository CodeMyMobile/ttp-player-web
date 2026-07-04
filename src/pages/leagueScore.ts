import type { LeagueFixture } from "../api/leagues";

// The stored `score` string is in the REPORTER's orientation, but games_1/games_2
// are player1-oriented. When the string's game totals match player2's (games_2),
// it's backwards vs "P1 vs P2" — flip each set so player1's games come first.
// Shared correctness helper: used by both LeagueDetailPage and the League Dashboard.
export const orientScore = (fixture: LeagueFixture): string => {
  const raw = String(fixture.score ?? "").trim();
  if (!raw) return "";
  const f = fixture as Record<string, unknown>;
  const g1 = Number(f.games_1);
  const g2 = Number(f.games_2);
  if (!Number.isFinite(g1) || !Number.isFinite(g2) || g1 === g2) return raw;
  const sets = raw.split(/\s+/).map((set) => set.split("-"));
  if (!sets.every((set) => set.length === 2 && set[0] !== "" && set[1] !== "")) return raw;
  const sumFirst = sets.reduce((total, set) => total + (Number(set[0]) || 0), 0);
  const sumSecond = sets.reduce((total, set) => total + (Number(set[1]) || 0), 0);
  if (sumFirst === g2 && sumSecond === g1) {
    return sets.map((set) => `${set[1]}-${set[0]}`).join(" ");
  }
  return raw;
};
