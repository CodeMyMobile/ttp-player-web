process.env.TZ = "America/Los_Angeles";

import test from "node:test";
import assert from "node:assert/strict";

import { loadMyWeek, type MyWeekApi } from "./loadMyWeek";

const NOW = new Date(2026, 10, 6, 10, 0);
const ME = new Set(["10", "sam rivera"]);

const api = (overrides: Partial<MyWeekApi> = {}): MyWeekApi & { calls: Record<string, unknown[]> } => {
  const calls: Record<string, unknown[]> = { lessons: [], matches: [], fixtures: [] };
  return {
    calls,
    upcomingLessons: async (options) => {
      calls.lessons.push(options);
      return {
        lessons: [{ id: 1, lessontype_id: 1, status: 1, start_date_time: "2026-11-07T18:00:00.000Z" }],
      };
    },
    myMatches: async (options) => {
      calls.matches.push(options);
      return {
        matches: [
          {
            id: 40,
            status: "upcoming",
            host_id: 10,
            start_date_time: "2026-11-08T19:00:00.000Z",
            participants: [{ player_id: 10, status: "hosting" }],
          },
        ],
      };
    },
    pendingInvites: async () => ({ invites: [] }),
    myLeagues: async () => ({
      leagues: [],
      sections: {
        mine: [
          { id: 7, name: "Fall Flex League", end_date: "2026-11-10" },
          { id: 8, name: "Winter League", end_date: "2027-01-31" },
        ],
      },
    }),
    leagueFixtures: async (leagueId) => {
      calls.fixtures.push(leagueId);
      return { fixtures: [{ id: 300, player1_id: 10, player2_id: 77, player2_name: "Alex Kim", status: "scheduled" }] };
    },
    ...overrides,
  };
};

test("loads the week from every source, for this week only", async () => {
  const stub = api();
  const { items, errors } = await loadMyWeek(stub, ME, NOW);
  assert.deepEqual(errors, {});
  assert.deepEqual(items.map((item) => item.id).sort(), ["leagueDue:300", "lesson:1", "match:40"]);
  // Local midnight today to local midnight a week later, as instants.
  assert.deepEqual(stub.calls.matches, [
    { from: new Date(2026, 10, 6).toISOString(), to: new Date(2026, 10, 13).toISOString() },
  ]);
  assert.deepEqual(stub.calls.lessons, [{ to: new Date(2026, 10, 13).toISOString() }]);
  // Fixtures only for the league ending this week.
  assert.deepEqual(stub.calls.fixtures, [7]);
});

test("no lessons (the API's 404) isn't an error", async () => {
  const { items, errors } = await loadMyWeek(
    api({ upcomingLessons: async () => Promise.reject(Object.assign(new Error("Lessons not found"), { status: 404 })) }),
    ME,
    NOW,
  );
  assert.equal(errors.lesson, undefined);
  assert.ok(items.some((item) => item.id === "match:40"));
});

test("a failing source is named, and the rest of the week still shows", async () => {
  const { items, errors } = await loadMyWeek(
    api({
      myMatches: async () => Promise.reject(Object.assign(new Error("down"), { status: 500 })),
      myLeagues: async () => Promise.reject(new Error("down")),
    }),
    ME,
    NOW,
  );
  assert.ok(errors.match);
  assert.ok(errors.leagueDue);
  assert.equal(errors.lesson, undefined);
  assert.deepEqual(items.map((item) => item.id), ["lesson:1"]);
});
