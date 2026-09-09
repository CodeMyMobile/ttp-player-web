// The Results tab, asserted against rendered markup.
//
// resultRows.test.ts covers the ordering; this file covers what reaches the page — that
// the rows come out in the order they were given, that the scope toggle only appears
// when there is something to scope to, and that filtering to none says so rather than
// looking like an empty league.

import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import LeagueTabs from "./LeagueTabs";
import { getLeagueData } from "./fixtures";
import type { LeagueData, ResultRow } from "./types";

const result = (over: Partial<ResultRow> = {}): ResultRow => ({
  id: "r1",
  winnerName: "Winner",
  loserName: "Loser",
  score: "6–4 6–4",
  playedAgo: "recently",
  playedDate: "2026-03-10T17:00:00.000Z",
  isYours: false,
  ...over,
});

const render = (results: ResultRow[]) => {
  const base = getLeagueData() as LeagueData;
  const data: LeagueData = { ...base, results };
  return renderToStaticMarkup(
    createElement(LeagueTabs, {
      data,
      activeTab: "results",
      onTabChange: () => {},
      onSchedule: () => {},
    }),
  );
};

test("rows render in the order given, winner first", () => {
  const html = render([
    result({ id: "a", winnerName: "Ada", loserName: "Bo" }),
    result({ id: "b", winnerName: "Cy", loserName: "Dee" }),
  ]);

  assert.ok(html.indexOf("Ada") < html.indexOf("Cy"), "first row should render first");
  assert.ok(html.indexOf("Ada") < html.indexOf("Bo"), "winner precedes loser");
});

test("no toggle when none of the results are the viewer's", () => {
  const html = render([result({ id: "a" }), result({ id: "b" })]);

  // A Mine button whose only outcome is an empty list is worse than no button.
  assert.doesNotMatch(html, /Filter results/);
  assert.doesNotMatch(html, />Mine</);
});

test("the toggle appears once the viewer has a result", () => {
  const html = render([result({ id: "a", isYours: true }), result({ id: "b" })]);

  assert.match(html, /Filter results/);
  assert.match(html, />All</);
  assert.match(html, />Mine</);
  // All is the default, and pressed state is what a screen reader reads.
  assert.match(html, /aria-pressed="true"[^>]*>All</);
});

test("the count describes what is shown, and reads naturally at one", () => {
  assert.match(render([result({ id: "a", isYours: true }), result({ id: "b" })]), /2 results/);
  assert.match(render([result({ id: "a", isYours: true })]), /1 result</);
});

test("an empty league still says nothing has been posted", () => {
  const html = render([]);

  assert.match(html, /No results posted yet\./);
  assert.doesNotMatch(html, /Filter results/);
});
