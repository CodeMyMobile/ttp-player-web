import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import LeagueSectionsV2, { stillToPlay } from "./LeagueSectionsV2";
import { getLeagueData } from "./fixtures";
import type { LeagueData } from "./types";

const base = getLeagueData() as LeagueData;
const opponent = (playerId: string) => ({ playerId, name: `P${playerId}`, ratingDelta: 0, lastActiveAt: "" });
const data: LeagueData = {
  ...base,
  scheduled: [],
  progress: { played: 3, total: 9, weeksLeft: 4 },
  nextMoveContext: { ...base.nextMoveContext, unplayed_opponents: [opponent(base.roster[0].playerId)] },
};

const render = (section: "schedule" | "standings" | "results", value: LeagueData = data) =>
  renderToStaticMarkup(
    createElement(LeagueSectionsV2, { data: value, section, onSection: () => {}, panel: { onSchedule: () => {} } }),
  );

test("Still to play is the roster cut to unplayed opponents", () => {
  assert.deepEqual(stillToPlay(data).map((player) => player.playerId), [base.roster[0].playerId]);
});

test("Schedule shows the summary, pace, Still to play and an empty Scheduled", () => {
  const html = render("schedule");
  assert.match(html, /3 of 9 played/);
  assert.match(html, /4 weeks left/);
  assert.match(html, /About 2 matches a week to finish on time/);
  assert.match(html, /Still to play/);
  assert.match(html, /Nothing booked yet/);
});

test("Still to play is left out when everyone's been played", () => {
  const html = render("schedule", { ...data, nextMoveContext: { ...data.nextMoveContext, unplayed_opponents: [] } });
  assert.doesNotMatch(html, /Still to play/);
});

test("Standings opens on the table, with a switch to the ladder", () => {
  const html = render("standings");
  assert.match(html, /aria-pressed="true"[^>]*>Table</);
  assert.match(html, />Ladder</);
});

const renderWithBets = (bestBets: unknown) =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(LeagueSectionsV2, {
        data,
        section: "schedule",
        onSection: () => {},
        bestBets: bestBets as never,
        panel: { onSchedule: () => {}, onProposeMatch: () => {} },
      }),
    ),
  );

const bet = (player_id: number, name: string, shared_count: number, shared_days: string[]) => ({
  player_id,
  name,
  has_availability: true,
  shared_count,
  shared_days,
  windows: [],
});

test("best bets: ranked rows with shared times, Arrange filled only on the first", () => {
  const html = renderWithBets({
    status: "ready",
    data: {
      tz: "America/Los_Angeles",
      has_availability: true,
      opponents: [bet(1, "Ana One", 3, ["Sat", "Sun", "Tue"]), bet(2, "Ben Two", 1, ["Tue"]), bet(3, "Cy Three", 0, [])],
    },
  });
  assert.match(html, /Best bets this week/);
  assert.match(html, /3 shared times · Sat, Sun, Tue/);
  assert.match(html, /1 shared time · Tue/);
  assert.doesNotMatch(html, /Cy Three/);
  assert.equal((html.match(/best-bets__arrange is-primary/g) || []).length, 1);
});

test("best bets: a viewer with no weekly times is asked to set them; failures show nothing", () => {
  assert.match(
    renderWithBets({ status: "ready", data: { tz: "x", has_availability: false, opponents: [] } }),
    /href="\/settings\/availability"/,
  );
  assert.doesNotMatch(renderWithBets({ status: "unavailable" }), /Best bets/);
});
