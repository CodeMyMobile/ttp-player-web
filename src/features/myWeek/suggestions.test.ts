process.env.TZ = "America/Los_Angeles";

import test from "node:test";
import assert from "node:assert/strict";

import { weekDays } from "../../utils/weekDays";
import { groupWeek, myMatchesToWeekItems } from "./adapters";
import {
  addSuggestions,
  circleMatchSuggestions,
  coachClassSuggestions,
  fitsSlotLabel,
  myWeekEventProps,
  nearbyClassSuggestions,
  openMatchSuggestions,
  videoSuggestions,
  workoutSuggestions,
} from "./suggestions";
import { readSkipped, skipSuggestion, unskipSuggestion } from "./skippedSuggestions";
import { loadSuggestions, type SuggestionsApi } from "./loadSuggestions";

// Friday 6 Nov 2026, 10am in Los Angeles.
const NOW = new Date(2026, 10, 6, 10, 0);
const NOW_MS = NOW.getTime();
const DAYS = weekDays(NOW);
const ME = new Set(["10", "sam rivera"]);
// Saturday 7 Nov, 9am Pacific, as a real instant.
const SAT_9AM = "2026-11-07T17:00:00.000Z";

const circleMatch = (overrides: Record<string, unknown> = {}) => ({
  match_id: 70,
  starts_at: SAT_9AM,
  location: "Penmar Park",
  format: "Doubles",
  spots_open: 1,
  people: [
    { id: 77, full_name: "Alex Kim", profile_picture: null },
    { id: 78, full_name: "Jo Park", profile_picture: "jo.jpg" },
  ],
  ...overrides,
});

test("a match friends are in is a green 'players' suggestion with who's playing", () => {
  const [item] = circleMatchSuggestions([circleMatch()], DAYS, []);
  assert.equal(item.type, "players");
  assert.equal(item.state, "suggested");
  assert.equal(item.needsResponse, false);
  assert.equal(item.dayKey, "2026-11-07");
  assert.equal(item.reason, "Alex + 1 you know are playing · 1 spot");
  assert.deepEqual(item.actions, ["join", "skip"]);
  assert.equal(item.refKey, "match:70");
});

test("the player's survey slots add 'Fits your…' and decide nothing else", () => {
  assert.equal(fitsSlotLabel(Date.parse(SAT_9AM), ["Weekends"]), "Fits your weekends");
  assert.equal(fitsSlotLabel(Date.parse(SAT_9AM), ["Weekday PM"]), null);
  // Monday 6:30pm.
  assert.equal(fitsSlotLabel(new Date(2026, 10, 9, 18, 30).getTime(), ["Weekday PM"]), "Fits your weekday afternoons and evenings");
  assert.match(circleMatchSuggestions([circleMatch()], DAYS, ["Weekends"])[0].reason ?? "", /Fits your weekends$/);
});

const openMatch = (overrides: Record<string, unknown> = {}) => ({
  id: 80,
  status: "upcoming",
  start_date_time: SAT_9AM,
  location_text: "Venice Courts",
  host_id: 99,
  skill_level_min: 3.0,
  skill_level_max: 4.0,
  participants: [{ player_id: 99, status: "hosting" }],
  invitees: [],
  capacity: { open: 1 },
  ...overrides,
});

test("open matches say 'At your level' only when their range holds the player's level", () => {
  const items = openMatchSuggestions(
    [openMatch(), openMatch({ id: 81, skill_level_min: null, skill_level_max: null }), openMatch({ id: 82, skill_level_min: 4.5, skill_level_max: 5 })],
    DAYS,
    ME,
    3.5,
    [],
    NOW_MS,
  );
  assert.deepEqual(
    items.map((item) => [item.id, item.reason]),
    [
      ["openMatch:80", "At your level · 3–4"],
      ["openMatch:81", "Open to all levels"],
      ["openMatch:82", "4.5–5"],
    ],
  );
});

test("matches the player hosts, is in, is invited to, or that are full aren't suggested", () => {
  const items = openMatchSuggestions(
    [
      openMatch({ id: 83, host_id: 10 }),
      openMatch({ id: 84, participants: [{ player_id: 10, status: "confirmed" }] }),
      openMatch({ id: 85, invitees: [{ invitee_id: 10, status: "pending" }] }),
      openMatch({ id: 86, capacity: { open: 0 } }),
    ],
    DAYS,
    ME,
    3.5,
    [],
    NOW_MS,
  );
  assert.deepEqual(items, []);
});

test("coach classes are read as the venue's clock time", () => {
  const [item] = coachClassSuggestions(
    [{ lesson_id: 12, coach_id: 20, coach_name: "Paul Cochrane", title: "Beginner clinic", starts_at: "2026-11-08T21:00:00", level_min: 3.5, level_max: 4, viewer_level: 3.5, spots_left: 3, location: "Penmar" }],
    DAYS,
    [],
    NOW_MS,
  );
  assert.equal(item.dayKey, "2026-11-08");
  assert.deepEqual(item.time, { kind: "fixed", startsAt: new Date(2026, 10, 8, 21, 0).getTime() });
  assert.equal(item.reason, "From your coach · At your level · 3 spots");
  assert.equal(item.href, "/group-lessons/12");
  assert.equal(item.refKey, "lesson:12");
});

test("nearby classes come in as already matched to the level", () => {
  const [item] = nearbyClassSuggestions(
    [
      {
        id: "13",
        title: "3.5 drill",
        levelPill: "3.5",
        external: false,
        spotsLabel: "2 spots left",
        path: "/group-lessons/13",
        when: "",
        whenShort: "",
        venue: "Westwood",
        coachName: "Maria",
        startsAt: new Date(2026, 10, 9, 18, 0),
      },
    ],
    DAYS,
    [],
  );
  assert.equal(item.reason, "2 spots left");
  assert.equal(item.dayKey, "2026-11-09");
});

test("a coach class claims a level only from its band, never from the old at_your_level flag", () => {
  const base = { lesson_id: 14, coach_name: "Maria", title: "Drill", starts_at: "2026-11-08T21:00:00", spots_left: 3 };
  const reasons = coachClassSuggestions(
    [
      { ...base, lesson_id: 14, at_your_level: true },
      { ...base, lesson_id: 15, level_min: 4, level_max: 4, viewer_level: 4.5 },
      { ...base, lesson_id: 16, level_min: 3, level_max: 3, viewer_level: 4.5 },
    ],
    DAYS,
    [],
    NOW_MS,
  ).map((item) => item.reason);
  assert.deepEqual(reasons, ["From your coach · 3 spots", "From your coach · Near your level · 3 spots", "From your coach · 3 spots"]);
});

test("nearby classes say 'At your level' only when their band holds the player's level", () => {
  const lesson = {
    id: "17",
    title: "4.0 drill",
    levelPill: "4.0",
    external: false,
    spotsLabel: "2 spots left",
    path: "/group-lessons/17",
    when: "",
    whenShort: "",
    venue: "Westwood",
    coachName: "Maria",
    startsAt: new Date(2026, 10, 9, 18, 0),
  };
  const reasonAt = (band: { min: number; max: number | null }, level: number) =>
    nearbyClassSuggestions([{ ...lesson, band }], DAYS, [], level)[0].reason;
  assert.equal(reasonAt({ min: 4, max: 4 }, 4), "At your level · 2 spots left");
  // The bug this fixes: a 4.0 class read "At your level" to a 4.5.
  assert.equal(reasonAt({ min: 4, max: 4 }, 4.5), "Near your level · 2 spots left");
});

test("the training plan: one start item until started, then a session a day and the rest day", () => {
  const [start] = workoutSuggestions(DAYS, null);
  assert.equal(start.id, "workout:start");
  assert.deepEqual(start.actions, ["start", "skip"]);

  const started = workoutSuggestions(DAYS, { startedOn: "2026-11-04", done: { "2026-11-06": true } });
  assert.equal(started.length, 7);
  assert.equal(started[0].title, "Day 3 · Mobility");
  assert.equal(started[0].done, true);
  assert.equal(started[0].href, "/training-plan?day=3");
  // 10 Nov is day 7: rest, nothing to tick.
  const rest = started.find((item) => item.dayKey === "2026-11-10")!;
  assert.equal(rest.title, "Day 7 · Rest");
  assert.deepEqual(rest.actions, []);
  // And it repeats: 11 Nov is day 1 again.
  assert.equal(started.find((item) => item.dayKey === "2026-11-11")!.title, "Day 1 · Lower strength");
});

test("one tip video a day, the same one the tip of the day picks", () => {
  const videos = ["a", "b", "c"].map((id) => ({ videoId: id, title: `Tip ${id}`, thumbnail: null, channel: "TTP" }));
  const items = videoSuggestions(DAYS, videos);
  assert.equal(items.length, 7);
  assert.equal(new Set(items.map((item) => item.dayKey)).size, 7);
  assert.notEqual(items[0].href, items[1].href);
  assert.equal(items[0].href?.startsWith("https://www.youtube.com/watch?v="), true);
  assert.deepEqual(videoSuggestions(DAYS, []), []);
});

test("each day: what's booked first, then two suggestions (fitting the slots first), a workout and a video", () => {
  const booked = myMatchesToWeekItems(
    [{ id: 70, status: "upcoming", host_id: 10, start_date_time: SAT_9AM, participants: [{ player_id: 10, status: "hosting" }] }],
    ME,
    DAYS,
  );
  const days = groupWeek(booked, DAYS);
  const suggestions = [
    // Already booked as match:70, so not suggested again.
    ...circleMatchSuggestions([circleMatch()], DAYS, []),
    // Saturday 2pm and 8pm open matches, and a 9am class.
    ...openMatchSuggestions(
      [openMatch({ id: 90, start_date_time: "2026-11-07T22:00:00.000Z" }), openMatch({ id: 91, start_date_time: "2026-11-08T04:00:00.000Z" })],
      DAYS,
      ME,
      3.5,
      [],
      NOW_MS,
    ),
    ...coachClassSuggestions([{ lesson_id: 12, starts_at: "2026-11-07T09:30:00", title: "Clinic" }], DAYS, [], NOW_MS),
    ...workoutSuggestions(DAYS, { startedOn: "2026-11-06", done: {} }),
    ...videoSuggestions(DAYS, [{ videoId: "a", title: "Tip", thumbnail: null, channel: null }]),
  ];
  const saturday = addSuggestions(days, suggestions, new Set(["openMatch:91"]), ["Weekends"]).find((day) => day.dayKey === "2026-11-07")!;
  assert.deepEqual(
    saturday.items.map((item) => item.id),
    ["match:70", "coachClass:12", "openMatch:90", "workout:2026-11-07", "video:2026-11-07"],
  );
});

test("a match that's both a friends' match and open nearby shows once, as the friends' one", () => {
  const days = groupWeek([], DAYS);
  const suggestions = [
    ...openMatchSuggestions([openMatch({ id: 70 })], DAYS, ME, 3.5, [], NOW_MS),
    ...circleMatchSuggestions([circleMatch()], DAYS, []),
  ];
  const saturday = addSuggestions(days, suggestions, new Set(), []).find((day) => day.dayKey === "2026-11-07")!;
  assert.deepEqual(saturday.items.map((item) => item.id), ["circleMatch:70"]);
});

test("skips are remembered until their day has passed", () => {
  const items = new Map<string, string>();
  const storage = { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
  skipSuggestion("openMatch:90", "2026-11-07", storage);
  skipSuggestion("video:2026-11-05", "2026-11-05", storage);
  assert.deepEqual([...readSkipped("2026-11-06", storage)], ["openMatch:90"]);
  // The past one is forgotten for good.
  assert.equal(JSON.parse(items.get("ttp_my_week_skipped") ?? "{}")["video:2026-11-05"], undefined);
  unskipSuggestion("openMatch:90", storage);
  assert.deepEqual([...readSkipped("2026-11-06", storage)], []);
});

test("analytics say what kind of item and where it sat, never which one", () => {
  const items = circleMatchSuggestions([circleMatch()], DAYS, []);
  const days = addSuggestions(groupWeek([], DAYS), items, new Set(), []);
  assert.deepEqual(myWeekEventProps(items[0], days), {
    source: "circleMatch",
    type: "players",
    state: "suggested",
    dayOffset: 1,
    position: 0,
    rankingVersion: "v1",
  });
});

test("the loader asks for this week at the player's level, and one failing source doesn't sink the rest", async () => {
  const asked: Record<string, unknown> = {};
  const api: SuggestionsApi = {
    circle: async () => Promise.reject(new Error("down")),
    playerLevel: async () => 3.5,
    openMatches: async (options) => {
      asked.open = options;
      return { matches: [openMatch()] };
    },
    nearbyClasses: async (options) => {
      asked.nearby = options;
      return [];
    },
    videos: async () => [],
  };
  const { items, errors } = await loadSuggestions(api, ME, [], NOW);
  assert.ok(errors.circle);
  assert.deepEqual(items.map((item) => item.id), ["openMatch:80"]);
  assert.deepEqual(asked.open, { from: new Date(2026, 10, 6).toISOString(), to: new Date(2026, 10, 13).toISOString(), level: 3.5 });
  assert.deepEqual(asked.nearby, { dateStart: "2026-11-06", dateEnd: "2026-11-12" });
});
