// The ladder row, asserted against rendered markup.
//
// ladderRow.test.ts covers the arithmetic; this file covers what actually
// reaches the page: which values appear on which line, that the viewer's row
// swaps its metadata for the gap copy and loses its challenge button, and that
// the row is not dressed up as something you can tap.

import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import LeagueTabs from "./LeagueTabs";
import { getLeagueData } from "./fixtures";
import type { LeagueData } from "./types";

const row = (over: Record<string, unknown> = {}) => ({
  playerId: "1",
  name: "Alex Gerszten",
  initials: "AG",
  rank: 1,
  rating: 6.789938,
  ratingLabel: "6.790",
  ratingType: "TPR",
  ntrpLabel: "4.25",
  utrLabel: "5.4",
  recordLabel: "3-1",
  wins: 3,
  losses: 1,
  isViewer: false,
  ratingBadge: "Verified",
  matchesPlayed: 12,
  ratingSource: null,
  ratingDeltaFromViewer: null,
  distanceLabel: null,
  courtLabels: [],
  suggestionReason: null,
  raw: {},
  ...over,
});

const render = (ladder: ReturnType<typeof row>[]) => {
  const base = getLeagueData();
  const data = { ...base, ladder } as unknown as LeagueData;
  return renderToStaticMarkup(
    createElement(LeagueTabs, {
      data,
      activeTab: "ladder",
      onTabChange: () => {},
      onSchedule: () => {},
      onChallenge: () => {},
      hideTabBar: true,
    } as Parameters<typeof LeagueTabs>[0]),
  );
};

/* the header */

test("the header explains why the ladder and the standings disagree", () => {
  const html = render([row()]);
  assert.ok(html.includes("Ranked by TPR across all your matches"));
  assert.ok(html.includes("Playoff spots come from"));
  assert.ok(html.includes("ladder-basis__link"), "standings is a control, not plain text");
});

test("no qualification or playoff-cut marker appears on this tab", () => {
  // Qualification is a standings concept and must not leak here.
  const html = render([row(), row({ playerId: "2", rank: 2, name: "Bea Ito" })]);
  for (const word of ["Qualif", "qualif", "cut line", "Playoff spot ", "In playoff"]) {
    assert.ok(!html.includes(word), `"${word}" must not appear on the ladder`);
  }
});

/* the row */

test("line two carries NTRP, UTR and the match count — not the league record", () => {
  const html = render([row()]);
  assert.ok(html.includes("NTRP 4.25"));
  assert.ok(html.includes("UTR 5.4"));
  assert.ok(html.includes("12 matches"));
  assert.ok(!html.includes("3-1"), "the league record belongs to Standings");
});

test("TPR shows two decimals, never three", () => {
  const html = render([row()]);
  assert.ok(html.includes("6.79"));
  assert.ok(!html.includes("6.790"), "the shared 3dp label must not reach the row");
});

test("the status badge sits in the TPR column and is never blank", () => {
  assert.ok(render([row({ ratingBadge: "Verified" })]).includes("Verified"));
  assert.ok(render([row({ ratingBadge: "Estimated" })]).includes("est."));
  assert.ok(render([row({ ratingBadge: null })]).includes("est."), "null is still a state");
});

test("a missing NTRP or UTR keeps its label and shows an em dash", () => {
  const html = render([row({ ntrpLabel: "-", utrLabel: "-" })]);
  assert.ok(html.includes("NTRP —"));
  assert.ok(html.includes("UTR —"));
});

test("a vouched player's zero match count is withheld", () => {
  const html = render([row({ matchesPlayed: 0, ratingBadge: "Verified" })]);
  assert.ok(!html.includes("0 matches"));
});

/* the viewer's row */

test("the viewer keeps the # prefix; everyone else is a plain number", () => {
  const html = render([
    row({ playerId: "1", rank: 1, name: "Ana Ruiz", rating: 7.12 }),
    row({ playerId: "2", rank: 2, name: "Paul Cochrane", rating: 6.0, isViewer: true }),
  ]);
  assert.ok(html.includes(">#2<"), "the viewer's rank is prefixed");
  assert.ok(html.includes(">1<"), "everyone else is plain");
});

test("the viewer's line two is the gap, and the challenge button is gone", () => {
  const html = render([
    row({ playerId: "1", rank: 1, name: "Ana Ruiz", rating: 6.14 }),
    row({ playerId: "2", rank: 2, name: "Paul Cochrane", rating: 6.0, isViewer: true }),
  ]);
  assert.ok(html.includes("0.14 behind #1"));
  assert.ok(!html.includes("Challenge Paul Cochrane"), "you cannot challenge yourself");
  assert.ok(html.includes("Challenge Ana Ruiz"), "but you can challenge everyone else");
});

test("a viewer at the top measures against the player below", () => {
  const html = render([
    row({ playerId: "1", rank: 1, name: "Paul Cochrane", rating: 7.12, isViewer: true }),
    row({ playerId: "2", rank: 2, name: "Ana Ruiz", rating: 6.0 }),
  ]);
  assert.ok(html.includes("1.12 clear of #2"));
});

/* affordances and edges */

test("the row is not dressed as tappable", () => {
  // Tapping does nothing, so it must not invite a tap.
  const html = render([row()]);
  assert.ok(!html.includes("chevron"), "no chevron");
  assert.ok(!/<div[^>]*class="ladder-row[^"]*"[^>]*onclick/i.test(html));
  assert.ok(!html.includes('role="button"'));
});

test("the challenge control is icon-only with an accessible name", () => {
  const html = render([row({ name: "Alex Gerszten" })]);
  assert.ok(html.includes('aria-label="Challenge Alex Gerszten"'));
});

test("a 28-character name truncates rather than wrapping", () => {
  const name = "Bartholomew Fotheringtonssen"; // exactly 28 characters
  const html = render([row({ name })]);
  assert.equal(name.length, 28, "fixture must stay at the specified length");
  assert.ok(html.includes("ladder-nm"), "the name cell owns the ellipsis rule");
  assert.ok(html.includes(name), "and the full name is still in the DOM for a11y");
});

test("an empty ladder says so rather than rendering an empty list", () => {
  assert.ok(render([]).includes("No rated players yet."));
});

test("a division where every TPR is identical renders cleanly", () => {
  const html = render([
    row({ playerId: "1", rank: 1, name: "Ana Ruiz", rating: 5 }),
    row({ playerId: "2", rank: 2, name: "Ben Tan", rating: 5 }),
    row({ playerId: "3", rank: 3, name: "Cara Lee", rating: 5 }),
  ]);
  assert.ok(!html.includes("NaN"));
  assert.equal((html.match(/ladder-row/g) ?? []).length, 3);
});
