import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { MatchSet } from "./scoring.ts";

const set = (you: number, opp: number, kind: "set" | "mtb" = "set"): MatchSet =>
  ({ kind, you, opp, tb: null });

test("SentCard explains the submitted score and 48-hour confirmation flow", async () => {
  Object.assign(globalThis, { React });
  const { SentCard } = await import("./SentCard.tsx");
  const html = renderToStaticMarkup(
    React.createElement(SentCard, {
      me: { id: "me", name: "Jordan Lee", ntrp: "4.0" },
      opponent: { id: "opp", name: "Paul Cochrane", ntrp: "4.0", color: "bg-sky-100 text-sky-700" },
      date: "2026-06-28",
      court: { id: "court-1", name: "Penmar Courts", area: "Venice" },
      sets: [set(6, 4), set(3, 6), set(10, 8, "mtb")],
      dnf: false,
      matchId: "123",
      status: "pending",
      onLogAnother: () => {},
    }),
  );

  assert.match(html, /Score submitted/);
  assert.match(html, /sent to Paul Cochrane for confirmation/);
  assert.match(html, /6-4\s+3-6\s+\[10-8\]/);
  assert.match(html, /What happens next/);
  assert.match(html, /Opponent confirms \(48 hours\)/);
  assert.match(html, /confirm or dispute your score/);
  assert.match(html, /If your opponent doesn&#x27;t confirm or dispute within 48 hours/);
  assert.match(html, /What if there&#x27;s a dispute\?/);
});
