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
    ntrp: "4.00",
    utr: "8.4",
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

const renderPlayers = (contactSheetEnabled: boolean, pointerCoarse = false) =>
  renderToStaticMarkup(
    createElement(LeagueTabs, {
      data,
      activeTab: "players",
      onTabChange: () => {},
      onSchedule: () => {},
      contactSheetEnabled,
      pointerCoarse,
      viewerName: "Paul Cochrane",
      hideTabBar: true,
    } as Parameters<typeof LeagueTabs>[0]),
  );

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

test("actions sit on the row — nothing expands", () => {
  const html = renderPlayers(true);
  assert.ok(!html.includes("aria-expanded"), "no disclosure widget");
  assert.ok(!html.includes("pcard-chevron"), "no chevron");
  assert.ok(html.includes("chans"), "channel chips are on the row itself");
});

test("an opted-out player shows the withheld state, not an empty slot", () => {
  const html = renderPlayers(true);
  assert.ok(html.includes("Number not shared"));
  assert.ok(html.includes("av-muted"), "their avatar is muted");
  // Only the in-app route remains for them.
  assert.ok(html.includes("Propose a match with Ben Withholder"));
  assert.ok(!html.includes("Text Ben Withholder"));
  assert.ok(!html.includes("Call Ben Withholder"));
  assert.ok(!html.includes("WhatsApp Ben Withholder"));
});

test("a sharing player shows their number as a third meta line", () => {
  const html = renderPlayers(true);
  assert.ok(html.includes("+1 (310) 555-0148"), "formatted number on the row");
});

test("the toolbar offers Need a match and never Log a Score", () => {
  const html = renderToStaticMarkup(
    createElement(LeagueTabs, {
      data,
      activeTab: "players",
      onTabChange: () => {},
      onSchedule: () => {},
      onNeedMatch: () => {},
      contactSheetEnabled: true,
      hideTabBar: true,
    } as Parameters<typeof LeagueTabs>[0]),
  );
  assert.ok(html.includes("Need a match"));
  assert.ok(!html.includes("Log a Score"), "a roster screen implies no finished match");
  assert.ok(html.includes("3 players"), "the count renders");
  assert.ok(html.includes("share a number with this division"), "the footnote renders");
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

test("the mobile meta line drops NTRP by class, keeping it in the markup for desktop", () => {
  // Hidden by media query rather than removed, so one render serves both widths.
  const html = renderPlayers(true);
  assert.ok(html.includes("rt-ntrp"), "NTRP is wrapped for the breakpoint to hide");
  assert.ok(html.includes("NTRP 4.00"));
});

/* channel sets by platform */

test("touch gets Text, Call and WhatsApp as real links", () => {
  const html = renderPlayers(true, true);
  assert.ok(html.includes(`href="sms:+1${SHARER_DIGITS}?body=`), "sms deeplink");
  assert.ok(html.includes(`href="tel:+1${SHARER_DIGITS}"`), "tel deeplink");
  assert.ok(html.includes(`wa.me/1${SHARER_DIGITS}`), "whatsapp link");
  assert.ok(html.includes("Text Ada Sharer"));
  assert.ok(html.includes("Call Ada Sharer"));
});

test("desktop replaces the dead links with copy and propose", () => {
  const html = renderPlayers(true, false);
  assert.ok(!html.includes('href="sms:'), "sms: does nothing on a fine pointer");
  assert.ok(!html.includes('href="tel:'), "nor does tel:");
  assert.ok(html.includes("Copy number for Ada Sharer"));
  assert.ok(html.includes("Propose a match with Ada Sharer"));
  assert.ok(html.includes(`wa.me/1${SHARER_DIGITS}`), "wa.me works on desktop, so it stays");
  assert.ok(!html.includes("disabled"), "no dead control is rendered");
});

test("the sms body is encoded once and uses ?body=", () => {
  const html = renderPlayers(true, true);
  assert.ok(html.includes("?body="), "the & form breaks Android");
  assert.ok(!html.includes("&amp;body="));
  assert.ok(!html.includes("%2520"), "no double encoding");
});
