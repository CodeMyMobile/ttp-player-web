import type { GroupLesson } from "../../api/groupLessons";
import { matchLessonsToLevel } from "../leagueDashboard/levelMatchedLessons";
import type { TipVideo } from "../../utils/tipOfDay";
import { weekBounds, weekDays } from "../../utils/weekDays";
import {
  circleMatchSuggestions,
  coachClassSuggestions,
  nearbyClassSuggestions,
  openMatchSuggestions,
  videoSuggestions,
} from "./suggestions";
import type { WeekItem } from "./types";

/**
 * Fetches My Week's suggestions: matches and classes from people the player knows, open
 * matches and classes nearby at their level, and a tip video a day. The training plan is
 * worked out on the screen (it's on this device). Each source fails on its own.
 *
 * Only the My Week screen loads these; the badge and Home don't.
 */

export interface SuggestionsApi {
  /** GET /matches/circle. */
  circle: () => Promise<unknown>;
  /** The player's NTRP (playerLevelOf), or null when we don't know it. */
  playerLevel: () => Promise<number | null>;
  /** GET /matches?filter=open&level=…, this week, near the player. */
  openMatches: (options: { from: string; to: string; level: number | null }) => Promise<{ matches: unknown[] }>;
  /** Mapped classes from POST /player/upcoming_group_lessons, this week, near the player. */
  nearbyClasses: (options: { dateStart: string; dateEnd: string }) => Promise<GroupLesson[]>;
  videos: () => Promise<TipVideo[]>;
}

export type SuggestionSource = "circle" | "openMatches" | "nearbyClasses" | "videos";

export interface SuggestionsLoad {
  items: WeekItem[];
  errors: Partial<Record<SuggestionSource, unknown>>;
}

export const loadSuggestions = async (
  api: SuggestionsApi,
  identities: Set<string>,
  slots: string[],
  now: Date = new Date(),
): Promise<SuggestionsLoad> => {
  const days = weekDays(now);
  const { start, end } = weekBounds(now);
  const nowMs = now.getTime();
  const errors: SuggestionsLoad["errors"] = {};

  const level = await api.playerLevel().catch(() => null);
  const [circle, open, nearby, videos] = await Promise.allSettled([
    api.circle(),
    api.openMatches({ from: start.toISOString(), to: end.toISOString(), level }),
    api.nearbyClasses({ dateStart: days[0].dayKey, dateEnd: days[days.length - 1].dayKey }),
    api.videos(),
  ]);

  const items: WeekItem[] = [];
  if (circle.status === "fulfilled") {
    const body = (circle.value ?? {}) as { matches?: unknown; group_lessons?: unknown };
    items.push(...circleMatchSuggestions(body.matches, days, slots));
    items.push(...coachClassSuggestions(body.group_lessons, days, slots, nowMs));
  } else errors.circle = circle.reason;

  if (open.status === "fulfilled") {
    items.push(...openMatchSuggestions(open.value.matches, days, identities, level, slots, nowMs));
  } else errors.openMatches = open.reason;

  if (nearby.status === "fulfilled") {
    items.push(...nearbyClassSuggestions(matchLessonsToLevel(nearby.value, level, nowMs), days, slots));
  } else errors.nearbyClasses = nearby.reason;

  if (videos.status === "fulfilled") items.push(...videoSuggestions(days, videos.value));
  else errors.videos = videos.reason;

  return { items, errors };
};
