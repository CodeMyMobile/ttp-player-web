// Group lessons at the viewer's level, for the league dashboard's coaching prompts:
// the "Group lessons at your level" card, the ladder nudge and the hero's clinic link.
//
// Which classes fit is decided by the Group Lessons page's own rule (fitsPlayerLevel),
// so "Browse all 4.0 lessons" opens a list that agrees with the card. On top of it, a
// class with no level is left out here: the page shows those to everyone, but calling
// one "curated for 4.0" would overclaim. Outside providers' classes are included, and
// link to their details page, from which the player books on the provider's site.

import moment from "moment";

import type { GroupLesson } from "../../api/groupLessons";
import { parseFloatingLocal } from "../../utils/floatingTime";
import {
  classLevelBand,
  fitsPlayerLevel,
  formatPlayerLevel,
  YOUR_LEVEL_FILTER,
  type LevelBand,
} from "../../utils/groupLessonLevelFit";
import { normalizeVenueLabel } from "../../utils/venueLabel";

/** An NTRP level as written in a division label ("Flex league · 4.0 · Men"). */
const LEVEL_IN_LABEL = /(?:^|[^\d.])([2-7]\.\d)(?![\d.])/;

/** The league's level from its division label, or null when the label has none. */
export const leagueLevelOf = (label: string | null | undefined): number | null => {
  const match = LEVEL_IN_LABEL.exec(String(label ?? ""));
  return match ? Number(match[1]) : null;
};

/**
 * The level to match lessons against: the player's own (played NTRP, then USTA, then
 * the rating quiz, as on the lessons page), else the league's.
 */
export const matchLevel = (playerLevel: number | null, leagueLevel: number | null): number | null =>
  playerLevel ?? leagueLevel;

/** "4.0" — the player's level as shown in pills and button labels. */
export const levelLabel = (level: number) => formatPlayerLevel(level);

/** "4.0–4.5" — the band a player of this level is pointed at. */
export const levelBandLabel = (level: number) => {
  const floor = Number(formatPlayerLevel(level));
  return `${floor.toFixed(1)}–${(floor + 0.5).toFixed(1)}`;
};

const bandLabel = (band: LevelBand) => {
  if (band.max === null) return `${band.min.toFixed(1)}+`;
  if (band.max === band.min) return band.min.toFixed(1);
  return `${band.min.toFixed(1)}–${band.max.toFixed(1)}`;
};

export interface LevelMatchedLesson {
  id: string;
  title: string;
  /** The class's own level, as its pill: "4.0–4.5", "4.0+", "4.0". */
  levelPill: string;
  /** True for an outside provider's class, booked on their site. */
  external: boolean;
  /** "3 spots left". Null for an outside class: we don't know its spots. */
  spotsLabel: string | null;
  /** Where its button goes: our booking flow, or the outside class's details page. */
  path: string;
  /** "Sat Oct 24 · 9:00 AM" in the venue's own time. */
  when: string;
  /** "Sat 9:00 AM", for the ladder nudge's "next:" clause. */
  whenShort: string;
  venue: string;
  coachName: string | null;
  startsAt: Date;
}

const GENERIC_COACH = /^(coach|external provider)$/i;

/**
 * Upcoming classes that fit the level and still have room, soonest first. Outside
 * providers' classes count as having room: we aren't told their spots, and the lessons
 * page lists them the same way.
 *
 * Start times are venue wall clocks stamped with a Z. They are compared to now with
 * parseFloatingLocal and formatted with moment.utc, exactly as the lessons page does,
 * so neither step shifts them by the timezone offset.
 */
export const matchLessonsToLevel = (
  lessons: GroupLesson[],
  level: number | null,
  now: number = Date.now(),
): LevelMatchedLesson[] => {
  if (level === null) return [];
  return lessons
    .flatMap((lesson) => {
      const external = Boolean(lesson.isExternal);
      if (!external && (lesson.cancelled || !(lesson.availableSpots > 0))) return [];
      const band = classLevelBand(lesson);
      if (band === null || !fitsPlayerLevel(band, level)) return [];
      const startsAt = parseFloatingLocal(lesson.startDateTime);
      if (!startsAt || startsAt.getTime() <= now) return [];
      const start = moment.utc(lesson.startDateTime);
      const coachName = lesson.coachName && !GENERIC_COACH.test(lesson.coachName.trim()) ? lesson.coachName : null;
      return [{
        id: lesson.id,
        title: lesson.title,
        levelPill: bandLabel(band),
        external,
        spotsLabel: external
          ? null
          : `${lesson.availableSpots} spot${lesson.availableSpots === 1 ? "" : "s"} left`,
        path: external ? `/lessons/external/${lesson.id}` : `/group-lessons/${lesson.id}`,
        when: `${start.format("ddd MMM D")} · ${start.format("h:mm A")}`,
        whenShort: start.format("ddd h:mm A"),
        venue: normalizeVenueLabel(lesson.locationName) || lesson.locationName,
        coachName,
        startsAt,
      }];
    })
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
};

/**
 * Router state that opens the Group Lessons page filtered to this level. "Your level"
 * when the page knows the player's level; otherwise (we fell back to the league's)
 * the page has no level of its own, so the exact level is passed instead.
 */
export const lessonsLinkState = (playerLevel: number | null, level: number | null) => ({
  groupLessonsState: {
    levelFilter: playerLevel !== null || level === null ? YOUR_LEVEL_FILTER : levelLabel(level),
  },
});

/** The ladder nudge's headline: chasing the player above, or holding first place. */
export const nudgeHeadline = (
  viewer: { rank: number; rating: number | null },
  above: { rank: number; rating: number | null } | null,
): string => {
  if (!above || viewer.rank <= 1) return "Stay on top";
  const gap =
    above.rating !== null && viewer.rating !== null && Number.isFinite(above.rating) && Number.isFinite(viewer.rating)
      ? (above.rating - viewer.rating).toFixed(2)
      : null;
  return gap ? `Close the ${gap} gap to #${above.rank}` : `Close the gap to #${above.rank}`;
};

/** The ladder nudge's second line. The "next:" clause only when a class fits. */
export const nudgeDetail = (band: string, next: LevelMatchedLesson | null): string =>
  next
    ? `Sharpen up with a ${band} clinic this week · next: ${next.whenShort} at ${next.venue}`
    : `Sharpen up with a ${band} clinic this week`;

// ─── Ladder nudge dismissal ─────────────────────────────────────────────

const DISMISS_DAYS = 7;
const dismissKey = (leagueId: string) => `league-ladder-nudge-dismissed:${leagueId}`;

/** Whether the nudge was dismissed for this league within the last 7 days. */
export const isNudgeDismissed = (leagueId: string, now: number = Date.now()): boolean => {
  try {
    const raw = window.localStorage.getItem(dismissKey(leagueId));
    const at = raw ? Number(raw) : NaN;
    return Number.isFinite(at) && now - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
};

export const dismissNudge = (leagueId: string, now: number = Date.now()) => {
  try {
    window.localStorage.setItem(dismissKey(leagueId), String(now));
  } catch {
    // Private mode or blocked storage: the nudge just comes back next visit.
  }
};
