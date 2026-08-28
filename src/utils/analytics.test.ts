import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ANALYTICS_EVENTS,
  RANKING_VERSION_NONE,
  VENUE_MATCH_LABEL,
  setAnalyticsProvider,
  track,
  type AnalyticsProps,
} from "./analytics";

const collect = () => {
  const seen: Array<{ event: string; props: AnalyticsProps }> = [];
  setAnalyticsProvider((event, props) => seen.push({ event, props }));
  return seen;
};

test("track is a no-op until a provider is set", () => {
  setAnalyticsProvider(null);
  // Must not throw with nothing wired up.
  assert.doesNotThrow(() => track(ANALYTICS_EVENTS.connectClicked, { position: 1 }));
});

test("track forwards event and props to the provider", () => {
  const seen = collect();
  track(ANALYTICS_EVENTS.findPlayersViewed, { viewerTier: "member", resultCount: 12 });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].event, "find_players_viewed");
  assert.deepEqual(seen[0].props, { viewerTier: "member", resultCount: 12 });
  setAnalyticsProvider(null);
});

test("a throwing provider never breaks the page it is measuring", () => {
  setAnalyticsProvider(() => {
    throw new Error("provider exploded");
  });
  assert.doesNotThrow(() => track(ANALYTICS_EVENTS.connectClicked, {}));
  setAnalyticsProvider(null);
});

test("track defaults props so call sites can omit them", () => {
  const seen = collect();
  track(ANALYTICS_EVENTS.profilePromptShown);
  assert.deepEqual(seen[0].props, {});
  setAnalyticsProvider(null);
});

test("measurement-method constants are versioned strings, not booleans", () => {
  // A boolean that is always false gets deleted by someone tidying up; a version
  // string explains itself and keeps the schema stable when ranking ships.
  assert.equal(RANKING_VERSION_NONE, "none");
  assert.equal(VENUE_MATCH_LABEL, "label");
});

test("event names are the agreed strings", () => {
  assert.deepEqual(ANALYTICS_EVENTS, {
    findPlayersViewed: "find_players_viewed",
    filtersApplied: "filters_applied",
    connectClicked: "connect_clicked",
    profilePromptShown: "profile_prompt_shown",
    profilePromptClicked: "profile_prompt_clicked",
    matchProfileCompleted: "match_profile_completed",
  });
});
