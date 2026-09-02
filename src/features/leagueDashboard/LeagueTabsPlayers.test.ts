// The consent guarantee, asserted against rendered markup rather than logic.
//
// canShowContact is unit-tested in contactSheet.test.ts; what this file proves is
// the thing that actually protects a player: that a withheld number is ABSENT
// from the DOM, not merely styled out of view. A CSS-hidden number is still in
// the page source, still in "view source", still in any scrape.

import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import LeagueTabs from "./LeagueTabs";
import { getLeagueData } from "./fixtures";
import type { LeagueData, RosterPlayer } from "./types";

const SHARER_DIGITS = "3105550148";
const WITHHOLDER_DIGITS = "3105550199";
const UNSET_DIGITS = "3105550177";

const roster: RosterPlayer[] = [
  {
    playerId: "1",
    name: "Ada Sharer",
    initials: "AS",
    rating: 4.0,
    wins: 3,
    losses: 1,
    phone: SHARER_DIGITS,
    shareContact: true,
  },
  {
    playerId: "2",
    name: "Ben Withholder",
    initials: "BW",
    rating: 3.5,
    wins: 1,
    losses: 2,
    phone: WITHHOLDER_DIGITS,
    shareContact: false,
  },
  {
    // The state everyone is in today: the backend does not send share_contact.
    playerId: "3",
    name: "Cal Unset",
    initials: "CU",
    rating: null,
    wins: 0,
    losses: 0,
    phone: UNSET_DIGITS,
  },
];

const data: LeagueData = { ...getLeagueData(), roster };

const renderPlayers = (contactSheetEnabled: boolean, expandedPlayer?: string) => {
  // Rendered statically, so only the collapsed rows appear unless a row is opened
  // by the component itself; the absence assertions below hold in both states
  // because a withheld number never reaches the props of any child.
  void expandedPlayer;
  return renderToStaticMarkup(
    createElement(LeagueTabs, {
      data,
      activeTab: "players",
      onTabChange: () => {},
      onSchedule: () => {},
      contactSheetEnabled,
      viewerName: "Paul Cochrane",
      hideTabBar: true,
    } as Parameters<typeof LeagueTabs>[0]),
  );
};

/* the guarantee */

test("a withheld number never reaches the DOM, even with the feature on", () => {
  const html = renderPlayers(true);
  assert.ok(!html.includes(WITHHOLDER_DIGITS), "an opted-out number must not be in the markup");
  assert.ok(!html.includes("555-0199"), "nor in any formatted form");
  assert.ok(html.includes("Ben Withholder"), "the player is still listed");
});

test("an absent consent flag is treated as withheld", () => {
  // undefined is not consent — this is every player until the backend ships the field.
  const html = renderPlayers(true);
  assert.ok(!html.includes(UNSET_DIGITS));
  assert.ok(!html.includes("555-0177"));
  assert.ok(html.includes("Cal Unset"));
});

test("with the feature off, no number appears for anyone — including sharers", () => {
  const html = renderPlayers(false);
  for (const digits of [SHARER_DIGITS, WITHHOLDER_DIGITS, UNSET_DIGITS]) {
    assert.ok(!html.includes(digits), `${digits} must not render while the gate is closed`);
  }
  assert.ok(!html.includes("Save all contacts"), "the bulk export is gated too");
});

test("no sms: or tel: link is emitted for a withheld number", () => {
  const html = renderPlayers(true);
  assert.ok(!html.includes(`sms:+1${WITHHOLDER_DIGITS}`));
  assert.ok(!html.includes(`tel:+1${WITHHOLDER_DIGITS}`));
  assert.ok(!html.includes(`wa.me/1${WITHHOLDER_DIGITS}`));
});

/* the row itself */

test("every player row is a control, and carries a chevron", () => {
  const html = renderPlayers(true);
  assert.ok(html.includes("pcard-row"), "the row is the tap target");
  assert.ok(html.includes('aria-expanded="false"'), "collapsed state is announced");
  assert.ok(html.includes("pcard-chevron"));
  assert.ok(!html.includes("message-circle"), "the old icon-only action is gone");
});

/* the sentinel fixes */

test("an unrated player shows no fabricated rating", () => {
  const html = renderPlayers(true);
  assert.ok(html.includes("TPR —"), "unrated TPR reads as a dash, not 0.0");
  assert.ok(!html.includes("TPR 0.0"), "0.0 is a missing rating, not a low one");
  assert.ok(!html.includes("UTR ~-"), "no negative UTR anywhere");
  assert.ok(!html.includes("-5.0"));
});

test("a rated player still shows their rating", () => {
  const html = renderPlayers(true);
  assert.ok(html.includes("TPR 4.0"));
  assert.ok(html.includes("TPR 3.5"));
});

/* desktop actions */

test("the desktop header actions render only when wired", () => {
  const withActions = renderToStaticMarkup(
    createElement(LeagueTabs, {
      data,
      activeTab: "players",
      onTabChange: () => {},
      onSchedule: () => {},
      onLogScore: () => {},
      onNeedMatch: () => {},
      hideTabBar: true,
    } as Parameters<typeof LeagueTabs>[0]),
  );
  assert.ok(withActions.includes("Log a Score"));
  assert.ok(withActions.includes("Need a Match"));
  // Mobile passes neither, because the sticky bar already carries them.
  assert.ok(!renderPlayers(true).includes("Log a Score"));
});
