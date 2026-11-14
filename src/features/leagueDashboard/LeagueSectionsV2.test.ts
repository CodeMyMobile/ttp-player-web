import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

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
