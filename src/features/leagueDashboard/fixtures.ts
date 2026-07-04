// Mock data for the League Dashboard, ported from docs/tennis-plan-league.html.
//
// This is the ONLY place hardcoded league data lives. Components read it through
// the hooks (hooks.ts) so a real API can replace these fixtures wholesale later.
// Numbers here are kept INTERNALLY CONSISTENT (banner count = pending rows,
// "looking" count = looking rows, open_match_count = looking rows) rather than
// copying the mock's deliberately-mismatched demo numbers — see the handoff notes.

import type { LeagueData, LeagueSummary, StandingRow } from "./types";

const initials = (name: string): string =>
  name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

// Compact standings builder: keeps each row to the numbers that vary.
type RowSeed = Omit<StandingRow, "initials"> & { initials?: string };
const row = (seed: RowSeed): StandingRow => ({
  ...seed,
  initials: seed.initials ?? initials(seed.name),
});

// ── League 1: Men's 4.0 Spring Flex League (active, the mock's default) ────────

const springStandings: StandingRow[] = [
  row({ rank: 1, playerId: "umair", name: "Umair Savani", matchesPlayed: 8, wins: 6, losses: 2, gameDiff: 24, gamesWon: 88, gamesLost: 64, trend: { dir: "flat" }, streak: 3 }),
  row({ rank: 2, playerId: "peter", name: "Peter Bergren", matchesPlayed: 5, wins: 4, losses: 1, gameDiff: 27, gamesWon: 59, gamesLost: 32, trend: { dir: "up", value: 1 } }),
  row({ rank: 3, playerId: "federico", name: "Federico Gagliardone", matchesPlayed: 5, wins: 4, losses: 1, gameDiff: 27, gamesWon: 52, gamesLost: 25, trend: { dir: "down", value: 1 } }),
  row({ rank: 4, playerId: "ryan", name: "Ryan Komori", matchesPlayed: 6, wins: 4, losses: 2, gameDiff: 12, gamesWon: 63, gamesLost: 51, trend: { dir: "flat" } }),
  row({ rank: 5, playerId: "erick", name: "Erick Street", matchesPlayed: 4, wins: 3, losses: 1, gameDiff: 8, gamesWon: 43, gamesLost: 35, trend: { dir: "up", value: 2 } }),
  row({ rank: 6, playerId: "danny", name: "Danny Eide", matchesPlayed: 6, wins: 3, losses: 3, gameDiff: 3, gamesWon: 53, gamesLost: 50, trend: { dir: "flat" } }),
  row({ rank: 7, playerId: "ivan", name: "Ivan Hee", matchesPlayed: 5, wins: 3, losses: 2, gameDiff: -5, gamesWon: 46, gamesLost: 51, trend: { dir: "flat" } }),
  row({ rank: 8, playerId: "tony", name: "Tony Croutch", matchesPlayed: 7, wins: 2, losses: 5, gameDiff: -21, gamesWon: 55, gamesLost: 76, trend: { dir: "flat" } }),
  row({ rank: 9, playerId: "oa", name: "OA Skywalker", matchesPlayed: 7, wins: 0, losses: 7, gameDiff: -39, gamesWon: 47, gamesLost: 86, trend: { dir: "flat" } }),
  row({ rank: 10, playerId: "saam", name: "Saam Shabahang", matchesPlayed: 3, wins: 0, losses: 3, gameDiff: -26, gamesWon: 10, gamesLost: 36, trend: { dir: "flat" } }),
  row({ rank: 11, playerId: "chad", name: "Chad Kushner", matchesPlayed: 2, wins: 0, losses: 2, gameDiff: -10, gamesWon: 16, gamesLost: 26, trend: { dir: "flat" } }),
  row({ rank: 12, playerId: "paul", name: "Paul Cochrane", matchesPlayed: 0, wins: 0, losses: 0, gameDiff: 0, gamesWon: 0, gamesLost: 0, trend: { dir: "flat", value: "play to qualify" }, isYou: true }),
  row({ rank: 13, playerId: "trevor", name: "Trevor Tetzlaff", matchesPlayed: 0, wins: 0, losses: 0, gameDiff: 0, gamesWon: 0, gamesLost: 0, trend: { dir: "flat" } }),
];

const springRoster = [
  ["umair", "Umair Savani", 7.2, 6, 2],
  ["peter", "Peter Bergren", 6.5, 4, 1],
  ["federico", "Federico Gagliardone", 6.4, 4, 1],
  ["ryan", "Ryan Komori", 6.1, 4, 2],
  ["erick", "Erick Street", 5.9, 3, 1],
  ["danny", "Danny Eide", 5.6, 3, 3],
  ["ivan", "Ivan Hee", 5.4, 3, 2],
  ["tony", "Tony Croutch", 5.0, 2, 5],
  ["oa", "OA Skywalker", 4.6, 0, 7],
  ["saam", "Saam Shabahang", 4.4, 0, 3],
  ["chad", "Chad Kushner", 4.3, 0, 2],
  ["paul", "Paul Cochrane", 4.5, 0, 0],
  ["trevor", "Trevor Tetzlaff", 4.5, 0, 0],
].map(([playerId, name, rating, wins, losses]) => ({
  playerId: playerId as string,
  name: name as string,
  initials: initials(name as string),
  rating: rating as number,
  wins: wins as number,
  losses: losses as number,
}));

const springLeague: LeagueData = {
  summary: {
    id: "spring-flex-40",
    name: "Men's 4.0 Spring Flex League",
    level: "Flex league · 4.0",
    eyebrow: "Flex league",
    sub: "13 active players · season ends Jul 31",
    status: { label: "You're #2", tone: "violet" },
    archived: false,
  },
  standings: springStandings,
  roster: springRoster,
  results: [
    { id: "r1", winnerName: "Umair Savani", loserName: "Tony Croutch", score: "6–3 6–2", playedAgo: "2 hours ago" },
    { id: "r2", winnerName: "Federico Gagliardone", loserName: "Danny Eide", score: "7–5 6–4", playedAgo: "5 hours ago" },
    { id: "r3", winnerName: "Ryan Komori", loserName: "OA Skywalker", score: "6–1 6–0", playedAgo: "Yesterday" },
    { id: "r4", winnerName: "Erick Street", loserName: "Ivan Hee", score: "6–4 3–6 6–2", playedAgo: "Yesterday" },
    { id: "r5", winnerName: "Peter Bergren", loserName: "Saam Shabahang", score: "6–2 6–2", playedAgo: "2 days ago" },
    { id: "r6", winnerName: "Umair Savani", loserName: "Chad Kushner", score: "6–0 6–1", playedAgo: "3 days ago" },
  ],
  pending: [
    { id: "p1", player1: "Paul Cochrane", player2: "Ivan Hee", isYours: true },
    { id: "p2", player1: "Paul Cochrane", player2: "Danny Eide", isYours: true },
    { id: "p3", player1: "Tony Croutch", player2: "Chad Kushner", isYours: false },
    { id: "p4", player1: "OA Skywalker", player2: "Saam Shabahang", isYours: false },
    { id: "p5", player1: "Federico Gagliardone", player2: "Erick Street", isYours: false },
  ],
  looking: [
    {
      playerId: "peter",
      name: "Peter Bergren",
      rating: 6.5,
      wins: 4,
      losses: 1,
      when: "Jul 7, 2026 · 3:00 PM",
      location: "2601 Motor Ave #3411, Los Angeles, CA 90064",
      stillNeedsToPlay: true,
    },
  ],
  ticker: [
    { id: "t1", text: "Umair d. Tony 6–3 6–2 · 2h ago" },
    { id: "t2", text: "Federico d. Danny 7–5 6–4 · 5h ago" },
    { id: "t3", text: "Ryan d. OA Skywalker 6–1 6–0 · yesterday" },
    { id: "t4", text: "Erick d. Ivan 6–4 3–6 6–2 · yesterday" },
    { id: "t5", text: "Peter d. Saam 6–2 6–2 · 2d ago" },
  ],
  week: {
    matchesPlayed: 8,
    scheduled: 5,
    biggestUpset: "Erick d. Ryan",
    hottestStreak: { name: "Umair", streak: 3 },
  },
  season: { label: "0 of 6 minimum matches", pct: 4 },
  hero: {
    badge: "New player",
    headline: "You haven't played yet.",
    sub: "Open matches are waiting. Win your first to climb off the bottom of the table.",
    ctaLabel: "Grab an open match",
    projectedChip: "Win your first → projected #9",
    rankStat: "—",
    rankLabel: "Unranked",
    tone: "violet",
  },
  // Viewer has posted availability and Peter matches it → Rung 1 (schedule).
  // Mirrors the mock's default "Availability matched" next-move card.
  nextMoveContext: {
    has_posted_availability: true,
    open_match_count: 1,
    matchmake_candidate: {
      playerId: "peter",
      name: "Peter Bergren",
      when: "Sat Jul 12 · 3 PM",
      distanceMiles: 4.2,
      ratingDelta: 0.5,
    },
    unscored_results: [],
    pending_challenges_for_me: [],
    unplayed_opponents: [],
  },
  pendingScoreCount: 5,
};

// ── Archived leagues (compact but complete datasets) ───────────────────────────

const winterStandings: StandingRow[] = [
  row({ rank: 1, playerId: "w-marco", name: "Marco Reyes", matchesPlayed: 12, wins: 11, losses: 1, gameDiff: 42, gamesWon: 132, gamesLost: 90, trend: { dir: "flat" } }),
  row({ rank: 2, playerId: "paul", name: "Paul Cochrane", matchesPlayed: 12, wins: 9, losses: 3, gameDiff: 28, gamesWon: 121, gamesLost: 93, trend: { dir: "flat" }, isYou: true }),
  row({ rank: 3, playerId: "w-devon", name: "Devon Clarke", matchesPlayed: 12, wins: 8, losses: 4, gameDiff: 15, gamesWon: 118, gamesLost: 103, trend: { dir: "flat" } }),
  row({ rank: 4, playerId: "w-samir", name: "Samir Patel", matchesPlayed: 12, wins: 6, losses: 6, gameDiff: -2, gamesWon: 104, gamesLost: 106, trend: { dir: "flat" } }),
  row({ rank: 5, playerId: "w-greg", name: "Greg Nolan", matchesPlayed: 12, wins: 4, losses: 8, gameDiff: -20, gamesWon: 96, gamesLost: 116, trend: { dir: "flat" } }),
  row({ rank: 6, playerId: "w-tomas", name: "Tomas Alvarez", matchesPlayed: 12, wins: 2, losses: 10, gameDiff: -33, gamesWon: 84, gamesLost: 117, trend: { dir: "flat" } }),
];

const winterLeague: LeagueData = {
  summary: {
    id: "winter-doubles-40",
    name: "Winter Doubles 4.0",
    level: "Doubles · ended Mar 2026",
    eyebrow: "Doubles league",
    sub: "Season ended · finished 2nd",
    status: { label: "Finished 2nd", tone: "gray" },
    archived: true,
  },
  standings: winterStandings,
  roster: winterStandings.map((s) => ({
    playerId: s.playerId,
    name: s.name,
    initials: s.initials,
    rating: 4.0 + (6 - s.rank) * 0.15,
    wins: s.wins,
    losses: s.losses,
  })),
  results: [
    { id: "wr1", winnerName: "Marco Reyes", loserName: "Paul Cochrane", score: "6–4 7–5", playedAgo: "Mar 21" },
    { id: "wr2", winnerName: "Paul Cochrane", loserName: "Devon Clarke", score: "6–2 6–3", playedAgo: "Mar 14" },
    { id: "wr3", winnerName: "Samir Patel", loserName: "Greg Nolan", score: "7–6 6–4", playedAgo: "Mar 10" },
  ],
  pending: [],
  looking: [],
  ticker: [
    { id: "wt1", text: "Final: Marco d. Paul 6–4 7–5 · title match" },
    { id: "wt2", text: "Paul d. Devon 6–2 6–3 · semifinal" },
  ],
  week: {
    matchesPlayed: 0,
    scheduled: 0,
    biggestUpset: "Season ended",
    hottestStreak: { name: "Marco", streak: 6 },
  },
  season: { label: "Season complete · 12 of 12 matches", pct: 100 },
  hero: {
    badge: "Season complete",
    headline: "You finished 2nd.",
    sub: "A strong season — you went 9–3 and just missed the title.",
    ctaLabel: "View full results",
    projectedChip: "Final standing → #2",
    rankStat: "#2",
    rankLabel: "Final rank",
    tone: "gray",
  },
  nextMoveContext: {
    has_posted_availability: true,
    open_match_count: 0,
    matchmake_candidate: null,
    unscored_results: [],
    pending_challenges_for_me: [],
    unplayed_opponents: [],
  },
  pendingScoreCount: 0,
};

const fallStandings: StandingRow[] = [
  row({ rank: 1, playerId: "paul", name: "Paul Cochrane", matchesPlayed: 12, wins: 10, losses: 2, gameDiff: 38, gamesWon: 128, gamesLost: 90, trend: { dir: "flat" }, isYou: true }),
  row({ rank: 2, playerId: "f-nate", name: "Nate Kim", matchesPlayed: 12, wins: 9, losses: 3, gameDiff: 25, gamesWon: 120, gamesLost: 95, trend: { dir: "flat" } }),
  row({ rank: 3, playerId: "f-owen", name: "Owen Diaz", matchesPlayed: 12, wins: 7, losses: 5, gameDiff: 9, gamesWon: 110, gamesLost: 101, trend: { dir: "flat" } }),
  row({ rank: 4, playerId: "f-luis", name: "Luis Ferro", matchesPlayed: 12, wins: 5, losses: 7, gameDiff: -8, gamesWon: 98, gamesLost: 106, trend: { dir: "flat" } }),
  row({ rank: 5, playerId: "f-brett", name: "Brett Owens", matchesPlayed: 12, wins: 3, losses: 9, gameDiff: -24, gamesWon: 88, gamesLost: 112, trend: { dir: "flat" } }),
];

const fallLeague: LeagueData = {
  summary: {
    id: "fall-singles-40",
    name: "Fall 4.0 Singles",
    level: "Singles · ended Dec 2025",
    eyebrow: "Singles league",
    sub: "Season ended · league champion",
    status: { label: "Won · 10–2", tone: "gray" },
    archived: true,
  },
  standings: fallStandings,
  roster: fallStandings.map((s) => ({
    playerId: s.playerId,
    name: s.name,
    initials: s.initials,
    rating: 4.1 + (5 - s.rank) * 0.2,
    wins: s.wins,
    losses: s.losses,
  })),
  results: [
    { id: "fr1", winnerName: "Paul Cochrane", loserName: "Nate Kim", score: "6–4 6–4", playedAgo: "Dec 12" },
    { id: "fr2", winnerName: "Paul Cochrane", loserName: "Owen Diaz", score: "6–1 6–2", playedAgo: "Dec 5" },
    { id: "fr3", winnerName: "Nate Kim", loserName: "Luis Ferro", score: "7–5 6–3", playedAgo: "Dec 1" },
  ],
  pending: [],
  looking: [],
  ticker: [
    { id: "ft1", text: "Champion: Paul d. Nate 6–4 6–4 · title match" },
    { id: "ft2", text: "Paul d. Owen 6–1 6–2 · semifinal" },
  ],
  week: {
    matchesPlayed: 0,
    scheduled: 0,
    biggestUpset: "Season ended",
    hottestStreak: { name: "Paul", streak: 5 },
  },
  season: { label: "Season complete · 12 of 12 matches", pct: 100 },
  hero: {
    badge: "Champion",
    headline: "You won the league.",
    sub: "10–2 and first place — the Fall 4.0 Singles title is yours.",
    ctaLabel: "View full results",
    projectedChip: "Final standing → #1",
    rankStat: "#1",
    rankLabel: "Champion",
    tone: "gray",
  },
  nextMoveContext: {
    has_posted_availability: true,
    open_match_count: 0,
    matchmake_candidate: null,
    unscored_results: [],
    pending_challenges_for_me: [],
    unplayed_opponents: [],
  },
  pendingScoreCount: 0,
};

const summerStandings: StandingRow[] = [
  row({ rank: 1, playerId: "s-derek", name: "Derek Hsu", matchesPlayed: 10, wins: 9, losses: 1, gameDiff: 36, gamesWon: 108, gamesLost: 72, trend: { dir: "flat" } }),
  row({ rank: 2, playerId: "s-ali", name: "Ali Mansour", matchesPlayed: 10, wins: 7, losses: 3, gameDiff: 18, gamesWon: 98, gamesLost: 80, trend: { dir: "flat" } }),
  row({ rank: 3, playerId: "s-jon", name: "Jon Pace", matchesPlayed: 10, wins: 6, losses: 4, gameDiff: 6, gamesWon: 90, gamesLost: 84, trend: { dir: "flat" } }),
  row({ rank: 4, playerId: "s-kyle", name: "Kyle Barnes", matchesPlayed: 10, wins: 5, losses: 5, gameDiff: -3, gamesWon: 84, gamesLost: 87, trend: { dir: "flat" } }),
  row({ rank: 5, playerId: "paul", name: "Paul Cochrane", matchesPlayed: 10, wins: 4, losses: 6, gameDiff: -10, gamesWon: 80, gamesLost: 90, trend: { dir: "flat" }, isYou: true }),
  row({ rank: 6, playerId: "s-rob", name: "Rob Feld", matchesPlayed: 10, wins: 2, losses: 8, gameDiff: -28, gamesWon: 70, gamesLost: 98, trend: { dir: "flat" } }),
];

const summerLeague: LeagueData = {
  summary: {
    id: "summer-ladder-35",
    name: "Summer 3.5 Ladder",
    level: "Ladder · ended Sep 2025",
    eyebrow: "Ladder",
    sub: "Season ended · finished 5th",
    status: { label: "Finished 5th", tone: "gray" },
    archived: true,
  },
  standings: summerStandings,
  roster: summerStandings.map((s) => ({
    playerId: s.playerId,
    name: s.name,
    initials: s.initials,
    rating: 3.4 + (6 - s.rank) * 0.1,
    wins: s.wins,
    losses: s.losses,
  })),
  results: [
    { id: "sr1", winnerName: "Derek Hsu", loserName: "Paul Cochrane", score: "6–3 6–4", playedAgo: "Sep 20" },
    { id: "sr2", winnerName: "Paul Cochrane", loserName: "Rob Feld", score: "6–2 6–1", playedAgo: "Sep 13" },
    { id: "sr3", winnerName: "Ali Mansour", loserName: "Jon Pace", score: "7–6 7–5", playedAgo: "Sep 8" },
  ],
  pending: [],
  looking: [],
  ticker: [
    { id: "st1", text: "Final ladder: Derek holds #1 · season closed" },
    { id: "st2", text: "Paul d. Rob 6–2 6–1 · last rung" },
  ],
  week: {
    matchesPlayed: 0,
    scheduled: 0,
    biggestUpset: "Season ended",
    hottestStreak: { name: "Derek", streak: 7 },
  },
  season: { label: "Season complete · 10 of 10 matches", pct: 100 },
  hero: {
    badge: "Season complete",
    headline: "You finished 5th.",
    sub: "A middle-of-the-ladder run at 4–6 — plenty to build on next season.",
    ctaLabel: "View full results",
    projectedChip: "Final standing → #5",
    rankStat: "#5",
    rankLabel: "Final rank",
    tone: "gray",
  },
  nextMoveContext: {
    has_posted_availability: true,
    open_match_count: 0,
    matchmake_candidate: null,
    unscored_results: [],
    pending_challenges_for_me: [],
    unplayed_opponents: [],
  },
  pendingScoreCount: 0,
};

// ── Registry ───────────────────────────────────────────────────────────────────

const leaguesById: Record<string, LeagueData> = {
  [springLeague.summary.id]: springLeague,
  [winterLeague.summary.id]: winterLeague,
  [fallLeague.summary.id]: fallLeague,
  [summerLeague.summary.id]: summerLeague,
};

/** Ordered list for the switcher (active first, then archived). */
export const leagueOrder: string[] = [
  springLeague.summary.id,
  winterLeague.summary.id,
  fallLeague.summary.id,
  summerLeague.summary.id,
];

export const DEFAULT_LEAGUE_ID = springLeague.summary.id;

export const getLeagueData = (leagueId?: string): LeagueData =>
  (leagueId && leaguesById[leagueId]) || springLeague;

export const getLeagueSummaries = (): LeagueSummary[] =>
  leagueOrder.map((id) => leaguesById[id].summary);
