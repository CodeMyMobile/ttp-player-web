import test from "node:test";
import assert from "node:assert/strict";

import { activePlaySection, PLAY_SECTIONS, playSectionDestination, playSectionHref } from "./playSections";

test("the four sections, in order", () => {
  assert.deepEqual(
    PLAY_SECTIONS.map((section) => section.label),
    ["Matches", "Lessons", "Leagues", "Players"],
  );
});

test("a deep link lands on its section's page, keeping the other params", () => {
  assert.equal(playSectionDestination("?section=players"), "/find-players");
  assert.equal(playSectionDestination("?section=players&radius=15&level=near"), "/find-players?radius=15&level=near");
  assert.equal(playSectionDestination("?section=lessons"), "/group-lessons");
  assert.equal(playSectionDestination("?section=leagues"), "/leagues");
});

test("no section, or one we don't have, opens Matches", () => {
  assert.equal(playSectionDestination(""), "/matches");
  assert.equal(playSectionDestination("?section=ladder"), "/matches");
});

test("links and the redirect agree", () => {
  const href = playSectionHref("players", { radius: "15", level: "near" });
  assert.equal(href, "/play?section=players&radius=15&level=near");
  assert.equal(playSectionDestination(href.slice(href.indexOf("?"))), "/find-players?radius=15&level=near");
});

test("the ladder and a league's own pages sit under Leagues", () => {
  assert.equal(activePlaySection("/ladder"), "leagues");
  assert.equal(activePlaySection("/leagues/7/dashboard"), "leagues");
  assert.equal(activePlaySection("/group-lessons"), "lessons");
  assert.equal(activePlaySection("/matches"), "matches");
  assert.equal(activePlaySection("/my-coaches"), null);
});
