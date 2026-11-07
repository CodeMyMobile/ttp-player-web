// The player's own tennis circle (GET /player/circle): the friends and coaches they picked as
// their go-to people, and suggestions to add. This turns the API's rows into what the Circle
// tab on the profile draws, so the wording is tested (there is no React test harness here).

export type CircleRole = "player" | "coach";
export type CircleLevelSource = "results" | "self" | null;

export interface CirclePersonRow {
  id: number;
  full_name: string | null;
  profile_picture: string | null;
  role: CircleRole;
  level: number | null;
  level_source: CircleLevelSource;
}

export interface CircleMember extends CirclePersonRow {
  added_at: string | null;
  /** Days the two have played. Everyone played is in the circle; null for someone only added. */
  played_together?: number | null;
}

export interface CircleSuggestion extends CirclePersonRow {
  reason: "your_coach" | "played_together";
  played_together: number | null;
}

export interface CircleListResponse {
  members?: CircleMember[];
  suggestions?: CircleSuggestion[];
  weekly_email?: boolean;
}

export interface CircleListItem {
  id: number;
  name: string;
  initials: string;
  avatarUrl: string | null;
  /** "Coach", "3.5 · from results", "3.5 · self-rated". */
  detail: string | null;
  /** Suggestions only: why they're suggested. */
  reason: string | null;
  href: string;
}

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export const initialsOf = (name: unknown): string =>
  clean(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

/** Levels are shown to one decimal, as the rest of the app shows NTRP: 3.5, 4.0, 3.75 stays. */
export const levelText = (level: number): string =>
  Number.isInteger(level * 2) ? level.toFixed(1) : String(level);

export const personDetail = (person: Pick<CirclePersonRow, "role" | "level" | "level_source">): string | null => {
  if (person.role === "coach") return "Coach";
  const level = toNumber(person.level);
  if (level === null) return null;
  if (person.level_source === "results") return `${levelText(level)} · from results`;
  if (person.level_source === "self") return `${levelText(level)} · self-rated`;
  return levelText(level);
};

/** "Played together once", "Played together 3 times", or null for none. */
export const playedLabel = (count: unknown): string | null => {
  const times = toNumber(count);
  if (!times || times < 1) return null;
  return times === 1 ? "Played together once" : `Played together ${times} times`;
};

export const suggestionReason = (suggestion: Pick<CircleSuggestion, "reason" | "played_together">): string | null => {
  if (suggestion.reason === "your_coach") return "Your coach";
  return suggestion.reason === "played_together" ? playedLabel(suggestion.played_together) : null;
};

/** Coaches open their coach page; players their player profile. */
export const profileHref = (person: Pick<CirclePersonRow, "id" | "role">): string =>
  person.role === "coach" ? `/coaches/${person.id}` : `/players/${person.id}`;

const toItem = (person: CirclePersonRow, reason: string | null): CircleListItem => ({
  id: person.id,
  name: clean(person.full_name) || (person.role === "coach" ? "Coach" : "Player"),
  initials: initialsOf(person.full_name) || "?",
  avatarUrl: clean(person.profile_picture) || null,
  detail: personDetail(person),
  reason,
  href: profileHref(person),
});

const validId = (person: { id?: unknown } | null | undefined) => toNumber(person?.id) !== null;

export const memberItems = (response: CircleListResponse | null | undefined): CircleListItem[] =>
  (response?.members ?? [])
    .filter(validId)
    .map((member) => toItem({ ...member, id: Number(member.id) }, playedLabel(member.played_together)));

/** Suggestions, less anyone already in the circle (the list can be stale after an add). */
export const suggestionItems = (
  response: CircleListResponse | null | undefined,
  memberIds: ReadonlySet<number> = new Set(),
): CircleListItem[] =>
  (response?.suggestions ?? [])
    .filter(validId)
    .filter((suggestion) => !memberIds.has(Number(suggestion.id)))
    .map((suggestion) => {
      const item = toItem({ ...suggestion, id: Number(suggestion.id) }, suggestionReason(suggestion));
      // "Your coach" already says they coach; "Your coach · Coach" says it twice.
      return suggestion.reason === "your_coach" ? { ...item, detail: null } : item;
    });

// --- searching by name (GET /player/circle/search) ---------------------------------------

export interface CircleSearchRow extends CirclePersonRow {
  in_circle: boolean;
}

export interface CircleSearchResponse {
  results?: CircleSearchRow[];
}

export interface CircleSearchItem extends CircleListItem {
  inCircle: boolean;
}

/** The API needs this many characters; fewer would list half the app. */
export const CIRCLE_SEARCH_MIN_LENGTH = 3;

/** What to send for what was typed: trimmed, single-spaced, or null when it's too short. */
export const circleSearchQuery = (typed: unknown): string | null => {
  const query = typeof typed === "string" ? typed.trim().replace(/\s+/g, " ") : "";
  return query.length >= CIRCLE_SEARCH_MIN_LENGTH ? query : null;
};

/** Search results as rows. In the circle if the API said so or they were added since. */
export const searchItems = (
  response: CircleSearchResponse | null | undefined,
  memberIds: ReadonlySet<number> = new Set(),
): CircleSearchItem[] =>
  (response?.results ?? [])
    .filter(validId)
    .map((row) => ({
      ...toItem({ ...row, id: Number(row.id) }, null),
      inCircle: row.in_circle === true || memberIds.has(Number(row.id)),
    }));

/** "No one yet", "1 person", "5 people". */
export const circleCountLabel = (count: number): string =>
  count === 0 ? "No one yet" : count === 1 ? "1 person" : `${count} people`;
