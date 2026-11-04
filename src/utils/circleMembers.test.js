import { test } from "node:test";
import assert from "node:assert/strict";
import {
  circleCountLabel,
  levelText,
  memberItems,
  personDetail,
  profileHref,
  suggestionItems,
  suggestionReason,
} from "./circleMembers.ts";

const person = (id, name, extra = {}) => ({
  id,
  full_name: name,
  profile_picture: null,
  role: "player",
  level: null,
  level_source: null,
  ...extra,
});

test("a coach reads as Coach, whatever level comes back", () => {
  assert.equal(personDetail({ role: "coach", level: 5, level_source: "self" }), "Coach");
});

test("a player's level says where it came from", () => {
  assert.equal(personDetail({ role: "player", level: 3.5, level_source: "results" }), "3.5 · from results");
  assert.equal(personDetail({ role: "player", level: 4, level_source: "self" }), "4.0 · self-rated");
  assert.equal(personDetail({ role: "player", level: 3.75, level_source: "results" }), "3.75 · from results");
  assert.equal(personDetail({ role: "player", level: null, level_source: null }), null);
});

test("levels keep one decimal for half steps and two for quarters", () => {
  assert.equal(levelText(3), "3.0");
  assert.equal(levelText(3.5), "3.5");
  assert.equal(levelText(3.25), "3.25");
});

test("suggestions say why: your coach, or how often you've played", () => {
  assert.equal(suggestionReason({ reason: "your_coach", played_together: null }), "Your coach");
  assert.equal(suggestionReason({ reason: "played_together", played_together: 1 }), "Played together once");
  assert.equal(suggestionReason({ reason: "played_together", played_together: 4 }), "Played together 4 times");
  assert.equal(suggestionReason({ reason: "played_together", played_together: 0 }), null);
});

test("coaches link to their coach page, players to their profile", () => {
  assert.equal(profileHref({ id: 7, role: "coach" }), "/coaches/7");
  assert.equal(profileHref({ id: 9, role: "player" }), "/players/9");
});

test("members become rows, with initials and a fallback name", () => {
  const rows = memberItems({
    members: [
      { ...person(2, "Casey Morgan", { level: 3.5, level_source: "results" }), added_at: "2026-11-01T00:00:00Z", played_together: 2 },
      { ...person(3, null, { role: "coach" }), added_at: null },
      { ...person(null, "No id"), added_at: null },
    ],
  });
  assert.deepEqual(rows, [
    {
      id: 2,
      name: "Casey Morgan",
      initials: "CM",
      avatarUrl: null,
      detail: "3.5 · from results",
      reason: "Played together 2 times",
      href: "/players/2",
    },
    { id: 3, name: "Coach", initials: "?", avatarUrl: null, detail: "Coach", reason: null, href: "/coaches/3" },
  ]);
});

test("suggestions leave out anyone already in the circle", () => {
  const rows = suggestionItems(
    {
      suggestions: [
        { ...person(2, "Casey Morgan"), reason: "played_together", played_together: 2 },
        { ...person(5, "Jo Lee", { role: "coach" }), reason: "your_coach", played_together: null },
      ],
    },
    new Set([2]),
  );
  assert.deepEqual(
    rows.map((row) => [row.id, row.reason, row.detail]),
    [[5, "Your coach", null]],
  );
});

test("an empty or missing answer gives no rows", () => {
  assert.deepEqual(memberItems(null), []);
  assert.deepEqual(suggestionItems({}), []);
});

test("the count reads naturally", () => {
  assert.equal(circleCountLabel(0), "No one yet");
  assert.equal(circleCountLabel(1), "1 person");
  assert.equal(circleCountLabel(6), "6 people");
});
