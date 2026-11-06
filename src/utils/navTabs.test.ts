import test from "node:test";
import assert from "node:assert/strict";

import { isTabActive, leaguesDestination, primaryNavTabs } from "./navTabs";

test("with My Week off, the tabs are today's", () => {
  assert.deepEqual(
    primaryNavTabs(false).map((tab) => [tab.label, tab.to]),
    [
      ["Home", "/"],
      ["Coaches", "/my-coaches"],
      ["Leagues", undefined],
      ["Schedule", "/player/calendar"],
    ],
  );
});

test("with My Week on: Home, Coaches, Play, My Week", () => {
  assert.deepEqual(
    primaryNavTabs(true).map((tab) => [tab.label, tab.to]),
    [
      ["Home", "/"],
      ["Coaches", "/my-coaches"],
      ["Play", "/play"],
      ["My Week", "/my-week"],
    ],
  );
});

test("Play lights up across match play, leagues, the ladder and logging a score", () => {
  const play = primaryNavTabs(true).find((tab) => tab.key === "play")!;
  for (const path of ["/play", "/matches", "/matches/12", "/leagues/4/dashboard", "/ladder", "/log-result"]) {
    assert.equal(isTabActive(path, play.match), true, path);
  }
  assert.equal(isTabActive("/my-week", play.match), false);
  assert.equal(isTabActive("/matchesx", play.match), false);
});

test("My Week stays lit on the old schedule address; Home only on /", () => {
  const [home, , , myWeek] = primaryNavTabs(true);
  assert.equal(isTabActive("/player/calendar", myWeek.match), true);
  assert.equal(isTabActive("/", home.match), true);
  assert.equal(isTabActive("/play", home.match), false);
});

test("Leagues opens the one league directly, otherwise the list", () => {
  assert.equal(leaguesDestination([{ id: 7 }]), "/leagues/7/dashboard");
  assert.equal(leaguesDestination([{ id: 7 }, { id: 8 }]), "/leagues");
  assert.equal(leaguesDestination([]), "/leagues");
  assert.equal(leaguesDestination(null), "/leagues");
});
