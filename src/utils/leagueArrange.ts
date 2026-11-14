import type { AvailabilityWindow } from "../api/availability";
import type { LeagueFixture, PlayedCourt } from "../api/leagues";

// Arranging a league fixture (home v2, §6.2): the "You're both free" suggestions, the times the
// player sends, and the "waiting for a pick" rows on the Schedule. ttp-api takes 1–4 times.

export const MAX_PROPOSED_TIMES = 4;
export const PRESELECTED = 3;

const sameId = (a: unknown, b: unknown) => a != null && b != null && String(a) === String(b);

/** "Sat, Nov 15 · 9:00 AM" in `timeZone` (the viewer's, by default). */
export const formatProposedTime = (iso: string, timeZone?: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone }).format(date);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(date);
  return `${day} · ${time}`;
};

const hourLabel = (iso: string, timeZone?: string) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", timeZone }).format(new Date(iso)).replace(" ", "").toLowerCase();

/** "Both free 9am–12pm". */
export const windowLabel = (window: Pick<AvailabilityWindow, "start" | "end">, timeZone?: string): string =>
  `Both free ${hourLabel(window.start, timeZone)}–${hourLabel(window.end, timeZone)}`;

export interface TimeChoice {
  key: string;
  start: string;
  /** Set for a shared window; absent for a time the player added. */
  window?: Pick<AvailabilityWindow, "start" | "end">;
}

/** One choice per shared window, proposing its start, soonest first. */
export const choicesFromWindows = (windows: AvailabilityWindow[]): TimeChoice[] =>
  [...windows]
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .map((window) => ({ key: window.start, start: window.start, window }));

/** The keys ticked to begin with: the first three suggestions. */
export const initialSelection = (choices: TimeChoice[]): Set<string> =>
  new Set(choices.slice(0, PRESELECTED).map((choice) => choice.key));

/** A `datetime-local` value ("2026-11-15T18:30", the browser's clock) as an ISO instant, or null. */
export const localInputToIso = (value: string): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** The ticked times to send: distinct, in the future, soonest first. */
export const timesToSend = (choices: TimeChoice[], selected: Set<string>, now: Date = new Date()): string[] =>
  [...new Set(choices.filter((choice) => selected.has(choice.key)).map((choice) => new Date(choice.start).toISOString()))]
    .filter((iso) => Date.parse(iso) > now.getTime())
    .sort((a, b) => Date.parse(a) - Date.parse(b));

/** The viewer's unplayed fixture against this opponent, or null (flex leagues may have none). */
export const fixtureAgainst = (fixtures: LeagueFixture[], opponentId: string | number): LeagueFixture | null =>
  fixtures.find(
    (fixture) =>
      (sameId(fixture.player1_id, opponentId) || sameId(fixture.player2_id, opponentId)) &&
      (fixture.status ?? "scheduled") === "scheduled" &&
      !(typeof fixture.score === "string" && fixture.score.trim()),
  ) ?? null;

export interface ProposalRow {
  fixtureId: string;
  matchId: number;
  opponentId: string;
  opponentName: string;
  /** The viewer sent the times (waiting on the opponent), or received them (theirs to pick). */
  sentByViewer: boolean;
  times: string[];
  location: string | null;
}

/** Fixtures with times proposed but none picked yet, for the Schedule. */
export const proposalRows = (fixtures: LeagueFixture[], viewerId: string | number | null): ProposalRow[] =>
  fixtures.flatMap((fixture) => {
    const match = fixture.scheduled_match;
    if (!match || match.picked || match.status !== "open") return [];
    const viewerIsP1 = sameId(fixture.player1_id, viewerId);
    const opponentName = (viewerIsP1 ? fixture.player2_name : fixture.player1_name) || "Your opponent";
    const opponentId = String(viewerIsP1 ? fixture.player2_id : fixture.player1_id);
    return [
      {
        fixtureId: String(fixture.id),
        matchId: match.id,
        opponentId,
        opponentName,
        sentByViewer: sameId(match.host_id, viewerId),
        times: match.proposed_times ?? [],
        location: match.location_text ?? null,
      },
    ];
  });

export interface CourtChip {
  id: string;
  name: string;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
  /** "You both play here", "Ana plays here" or "You play here". */
  note: string;
}

export const MAX_COURT_CHIPS = 4;

/**
 * Court chips for the propose screen: courts both players have played at first, then the
 * opponent's (they're being asked to come), then the viewer's. Each court once, at most four.
 */
export const courtChips = (mine: PlayedCourt[], theirs: PlayedCourt[], opponentFirst: string): CourtChip[] => {
  const mineIds = new Set(mine.map((court) => String(court.id)));
  const theirIds = new Set(theirs.map((court) => String(court.id)));
  const chip = (court: PlayedCourt, note: string): CourtChip => ({
    id: String(court.id),
    name: court.name,
    area: court.area ?? null,
    latitude: court.latitude ?? null,
    longitude: court.longitude ?? null,
    note,
  });
  const both = theirs.filter((court) => mineIds.has(String(court.id))).map((court) => chip(court, "You both play here"));
  const theirsOnly = theirs.filter((court) => !mineIds.has(String(court.id))).map((court) => chip(court, `${opponentFirst} plays here`));
  const mineOnly = mine.filter((court) => !theirIds.has(String(court.id))).map((court) => chip(court, "You play here"));
  return [...both, ...theirsOnly, ...mineOnly].slice(0, MAX_COURT_CHIPS);
};
