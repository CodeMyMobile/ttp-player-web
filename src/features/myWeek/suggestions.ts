import { TRAINING_PLAN_DAYS } from "../../data/trainingPlan";
import type { LevelMatchedLesson } from "../leagueDashboard/levelMatchedLessons";
import { pickTipOfDay, type TipVideo } from "../../utils/tipOfDay";
import { matchesViewer } from "../../utils/leagueSeason";
import { isInWeek, readStart, type WeekDay } from "../../utils/weekDays";
import { toLocalYmd } from "../../utils/dateTime";
import { planDayFor, REST_DAY, type TrainingPlanProgress } from "./trainingPlanProgress";
import type { WeekDayItems, WeekItem, WeekPerson } from "./types";

/**
 * Suggestions for My Week: what the player could add to their week. Pure: the loader fetches,
 * these decide. Ranked per day, after anything booked or waiting, by the player's own survey
 * availability (fitsSlotLabel). None counts toward the badge.
 */

type Row = Record<string, unknown>;

const asRows = (value: unknown): Row[] =>
  Array.isArray(value) ? value.filter((row): row is Row => Boolean(row) && typeof row === "object") : [];

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);
const firstName = (name: string) => name.split(/\s+/)[0] || name;

// --- the player's availability (survey slots) -------------------------------------------

/** The survey's three slots, canonical: "Weekdays AM", "Weekday PM", "Weekends". */
const SLOT_LABELS: Record<string, string> = {
  "weekdays am": "weekday mornings",
  "weekday pm": "weekday afternoons and evenings",
  weekends: "weekends",
};

const slotOf = (startsAt: number): string => {
  const date = new Date(startsAt);
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  if (weekend) return "weekends";
  return date.getHours() < 12 ? "weekdays am" : "weekday pm";
};

/** "Fits your weekends", when the time falls in one of the player's slots; else null. */
export const fitsSlotLabel = (startsAt: number, slots: string[]): string | null => {
  const wanted = new Set(slots.map((slot) => slot.trim().toLowerCase()));
  const slot = slotOf(startsAt);
  return wanted.has(slot) ? `Fits your ${SLOT_LABELS[slot]}` : null;
};

const withFit = (reason: string, startsAt: number, slots: string[]) => {
  const fit = fitsSlotLabel(startsAt, slots);
  return fit ? `${reason} · ${fit}` : reason;
};

// --- matches ------------------------------------------------------------------------------

/**
 * Open matches people the player knows are in (GET /matches/circle → matches). Green: these
 * are the week's "friends looking to play".
 */
export const circleMatchSuggestions = (rows: unknown, days: WeekDay[], slots: string[]): WeekItem[] =>
  asRows(rows).flatMap((match): WeekItem[] => {
    const start = readStart(match.starts_at, "instant");
    if (!start || !isInWeek(start.dayKey, days)) return [];
    const people = asRows(match.people)
      .map((person): WeekPerson | null => {
        const name = text(person.full_name);
        return name ? { id: String(person.id), name, photoUrl: text(person.profile_picture) } : null;
      })
      .filter((person): person is WeekPerson => Boolean(person));
    const lead = people[0] ? firstName(people[0].name) : "People you know";
    const others = people.length > 1 ? ` + ${people.length - 1} you know` : "";
    const spots = Number(match.spots_open);
    const spotText = Number.isFinite(spots) && spots > 0 ? ` · ${spots} spot${spots === 1 ? "" : "s"}` : "";
    return [
      {
        id: `circleMatch:${match.match_id}`,
        source: "circleMatch",
        type: "players",
        state: "suggested",
        needsResponse: false,
        dayKey: start.dayKey,
        time: { kind: "fixed", startsAt: start.startsAt },
        title: text(match.location) ? `Match at ${text(match.location)}` : "Open match",
        subtitle: text(match.format),
        people,
        reason: withFit(`${lead}${others} ${people.length > 1 ? "are" : "is"} playing${spotText}`, start.startsAt, slots),
        actions: ["join", "skip"],
        href: `/matches/${match.match_id}`,
        raw: match,
        refKey: `match:${match.match_id}`,
      },
    ];
  });

/**
 * Open matches near the player, from GET /matches?filter=open&level=…, which keeps matches
 * whose level range holds the player's NTRP and lets ones with no range through. Only a range
 * that holds it is called "At your level"; the rest say "Open to all levels".
 */
export const openMatchSuggestions = (
  rows: unknown,
  days: WeekDay[],
  identities: Set<string>,
  playerLevel: number | null,
  slots: string[],
  now: number,
): WeekItem[] =>
  asRows(rows).flatMap((match): WeekItem[] => {
    const start = readStart(match.start_date_time, "instant");
    if (!start || !isInWeek(start.dayKey, days) || start.startsAt <= now) return [];
    if (["cancelled", "completed"].includes(String(match.status))) return [];
    const involved = [...asRows(match.participants), ...asRows(match.invitees)].some((row) =>
      matchesViewer(identities, row.player_id ?? row.invitee_id),
    );
    if (involved || matchesViewer(identities, match.host_id)) return [];
    const capacity = (match.capacity ?? {}) as Row;
    if (Number(capacity.open) === 0) return [];

    const min = Number(match.skill_level_min);
    const max = Number(match.skill_level_max);
    const ranged = match.skill_level_min != null && match.skill_level_max != null && Number.isFinite(min) && Number.isFinite(max);
    const atLevel = ranged && playerLevel !== null && playerLevel >= min && playerLevel <= max;
    const levelText = atLevel ? `At your level · ${min}–${max}` : ranged ? `${min}–${max}` : "Open to all levels";
    const location = text(match.location_text) ?? text(match.location);
    return [
      {
        id: `openMatch:${match.id}`,
        source: "openMatch",
        type: "match",
        state: "suggested",
        needsResponse: false,
        dayKey: start.dayKey,
        time: { kind: "fixed", startsAt: start.startsAt },
        title: location ? `Match at ${location}` : "Open match",
        subtitle: text(match.format) ?? text(match.match_format),
        people: [],
        reason: withFit(levelText, start.startsAt, slots),
        actions: ["join", "skip"],
        href: `/matches/${match.id}`,
        raw: match,
        refKey: `match:${match.id}`,
      },
    ];
  });

// --- group lessons ------------------------------------------------------------------------

/** Classes from the player's coaches at their level (GET /matches/circle → group_lessons). */
export const coachClassSuggestions = (rows: unknown, days: WeekDay[], slots: string[], now: number): WeekItem[] =>
  asRows(rows).flatMap((row): WeekItem[] => {
    // starts_at is the venue's wall clock, without a Z.
    const start = readStart(row.starts_at, "wallClock");
    if (!start || !isInWeek(start.dayKey, days) || start.startsAt <= now) return [];
    const spots = Number(row.spots_left);
    const parts = [
      "From your coach",
      row.at_your_level === true ? "At your level" : null,
      Number.isFinite(spots) && spots > 0 ? `${spots} spot${spots === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    const coach = text(row.coach_name);
    return [
      {
        id: `coachClass:${row.lesson_id}`,
        source: "coachClass",
        type: "lesson",
        state: "suggested",
        needsResponse: false,
        dayKey: start.dayKey,
        time: { kind: "fixed", startsAt: start.startsAt },
        title: text(row.title) ?? (coach ? `Group lesson with ${coach}` : "Group lesson"),
        subtitle: text(row.location),
        people: coach ? [{ id: row.coach_id != null ? String(row.coach_id) : null, name: coach, photoUrl: text(row.coach_picture) }] : [],
        reason: withFit(parts.join(" · "), start.startsAt, slots),
        actions: ["book", "skip"],
        href: `/group-lessons/${row.lesson_id}`,
        raw: row,
        refKey: `lesson:${row.lesson_id}`,
      },
    ];
  });

/** Other classes nearby that fit the player's level (matchLessonsToLevel decided which). */
export const nearbyClassSuggestions = (lessons: LevelMatchedLesson[], days: WeekDay[], slots: string[]): WeekItem[] =>
  lessons.flatMap((lesson): WeekItem[] => {
    if (lesson.external) return [];
    const startsAt = lesson.startsAt.getTime();
    const dayKey = toLocalYmd(lesson.startsAt);
    if (!isInWeek(dayKey, days)) return [];
    return [
      {
        id: `nearbyClass:${lesson.id}`,
        source: "nearbyClass",
        type: "lesson",
        state: "suggested",
        needsResponse: false,
        dayKey,
        time: { kind: "fixed", startsAt },
        title: lesson.title,
        subtitle: lesson.venue || null,
        people: lesson.coachName ? [{ id: null, name: lesson.coachName, photoUrl: null }] : [],
        reason: withFit(["At your level", lesson.spotsLabel].filter(Boolean).join(" · "), startsAt, slots),
        actions: ["book", "skip"],
        href: lesson.path,
        raw: lesson,
        refKey: `lesson:${lesson.id}`,
      },
    ];
  });

// --- off court ----------------------------------------------------------------------------

/**
 * The training plan. Not started: one "Start your plan" item today. Started: each day's
 * session, or the rest day (nothing to tick).
 */
export const workoutSuggestions = (days: WeekDay[], progress: TrainingPlanProgress | null): WeekItem[] => {
  if (!days.length) return [];
  if (!progress) {
    return [
      {
        id: `workout:start`,
        source: "workout",
        type: "workout",
        state: "suggested",
        needsResponse: false,
        dayKey: days[0].dayKey,
        time: { kind: "flexible", label: "Any time" },
        title: "Start your 7-day training plan",
        subtitle: "Off-court strength and mobility, about 35 minutes a day",
        people: [],
        reason: null,
        actions: ["start", "skip"],
        href: "/training-plan",
        raw: null,
      },
    ];
  }
  return days.flatMap(({ dayKey }): WeekItem[] => {
    const n = planDayFor(dayKey, progress.startedOn);
    if (n === null) return [];
    const plan = TRAINING_PLAN_DAYS[n - 1] as { title: string; time: string; sub?: string };
    const rest = n === REST_DAY;
    return [
      {
        id: `workout:${dayKey}`,
        source: "workout",
        type: "workout",
        state: "suggested",
        needsResponse: false,
        dayKey,
        time: { kind: "flexible", label: rest ? "Rest day" : "Any time" },
        title: rest ? `Day ${n} · Rest` : `Day ${n} · ${plan.title}`,
        subtitle: rest ? null : [plan.time, plan.sub].filter((part) => part && part !== "—").join(" · ") || null,
        people: [],
        reason: null,
        actions: rest ? [] : ["done", "open"],
        href: `/training-plan?day=${n}`,
        raw: { planDay: n },
        done: Boolean(progress.done[dayKey]),
      },
    ];
  });
};

/** One tip video per day, the one the tip of the day picks for that date. */
export const videoSuggestions = (days: WeekDay[], videos: TipVideo[]): WeekItem[] =>
  days.flatMap(({ dayKey, start }): WeekItem[] => {
    const video = pickTipOfDay(videos, start);
    if (!video?.videoId) return [];
    return [
      {
        id: `video:${dayKey}`,
        source: "video",
        type: "watch",
        state: "suggested",
        needsResponse: false,
        dayKey,
        time: { kind: "flexible", label: "Any time" },
        title: video.title || "Tip of the day",
        subtitle: [video.channel, video.duration].filter(Boolean).join(" · ") || null,
        people: [],
        reason: null,
        actions: ["watch", "skip"],
        href: `https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}`,
        raw: video,
      },
    ];
  });

// --- putting suggestions into the week ----------------------------------------------------

export const MAX_SUGGESTIONS_PER_DAY = 2;

/** "match:40" / "lesson:12" for everything already booked or waiting. */
export const bookedKeys = (items: WeekItem[]): Set<string> =>
  new Set(
    items.flatMap((item) => {
      const id = item.id.slice(item.id.indexOf(":") + 1);
      if (item.source === "lesson" || item.source === "groupLesson") return [`lesson:${id}`];
      if (item.source === "match" || item.source === "sentInvite") return [`match:${id}`];
      if (item.source === "invite") {
        const match = (item.raw as { match?: { id?: unknown } } | null)?.match;
        return match?.id != null ? [`match:${match.id}`] : [];
      }
      return [];
    }),
  );

const fixedTime = (item: WeekItem) => (item.time.kind === "fixed" ? item.time.startsAt : Number.MAX_SAFE_INTEGER);

/**
 * The day with suggestions added: what's booked or waiting first, then up to two match,
 * players or lesson suggestions (ones fitting the player's slots first, then by time), then
 * the day's workout and video. Skipped suggestions, and ones for something already on the
 * week, are left out; a suggestion appearing twice (a friends' match also open nearby) shows
 * once, as the friends' one.
 */
export const addSuggestions = (
  days: WeekDayItems[],
  suggestions: WeekItem[],
  skipped: Set<string>,
  slots: string[],
): WeekDayItems[] => {
  const taken = bookedKeys(days.flatMap((day) => day.items));
  const seen = new Set<string>();
  // Friends' matches and coaches' classes first, so a duplicate keeps that version.
  const usable = orderSources(suggestions).filter((item) => {
    if (skipped.has(item.id)) return false;
    if (item.refKey && taken.has(item.refKey)) return false;
    const key = item.refKey ?? item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return days.map((day) => {
    const mine = usable.filter((item) => item.dayKey === day.dayKey);
    const ranked = mine
      .filter((item) => item.type === "match" || item.type === "players" || item.type === "lesson")
      .sort((a, b) => {
        const fit = Number(Boolean(fitsSlotLabel(fixedTime(b), slots))) - Number(Boolean(fitsSlotLabel(fixedTime(a), slots)));
        return fit !== 0 ? fit : fixedTime(a) - fixedTime(b);
      })
      .slice(0, MAX_SUGGESTIONS_PER_DAY);
    const workout = mine.filter((item) => item.type === "workout").slice(0, 1);
    const video = mine.filter((item) => item.type === "watch").slice(0, 1);
    return { ...day, items: [...day.items, ...ranked, ...workout, ...video] };
  });
};

/** Where to look first: circle matches before open ones of the same match (see addSuggestions). */
export const orderSources = (items: WeekItem[]): WeekItem[] => {
  const rank: Record<string, number> = { circleMatch: 0, coachClass: 1, openMatch: 2, nearbyClass: 3, workout: 4, video: 5 };
  return [...items].sort((a, b) => (rank[a.source] ?? 9) - (rank[b.source] ?? 9));
};

// --- analytics ----------------------------------------------------------------------------

export type MyWeekTrackedAction = "skip" | "join" | "book" | "done" | "watch";

/**
 * Properties for a My Week analytics event: what kind of item, where it sat, never which one
 * (utils/analytics: properties about the target, not the target).
 */
export const myWeekEventProps = (
  item: WeekItem,
  days: WeekDayItems[],
): { source: string; type: string; state: string; dayOffset: number; position: number; rankingVersion: string } => {
  const dayOffset = days.findIndex((day) => day.dayKey === item.dayKey);
  const day = days[dayOffset];
  return {
    source: item.source,
    type: item.type,
    state: item.state,
    dayOffset,
    position: day ? day.items.findIndex((entry) => entry.id === item.id) : -1,
    rankingVersion: "v1",
  };
};
