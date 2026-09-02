import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import PlayerContactSheet from "./PlayerContactSheet";

// createElement rather than JSX: the npm test glob matches *.test.ts / *.test.js
// only, so a .test.tsx file is collected by nothing and silently never runs.
// (src/components/payments/LessonPaymentSummary.test.tsx is in exactly that state.)
type Props = Parameters<typeof PlayerContactSheet>[0];

const render = (over: Partial<Props> = {}) =>
  renderToStaticMarkup(
    createElement(PlayerContactSheet, {
      id: "sheet-1",
      playerName: "Alex Gerszten",
      phone: "3105550148",
      leagueName: "Men's 4.0 Fall Flex 2026",
      senderName: "Paul Cochrane",
      pointerCoarse: true,
      onProposeMatch: () => {},
      ...over,
    } as Props),
  );

test("the sheet shows the formatted number and a copy control", () => {
  const html = render();
  assert.ok(html.includes("+1 (310) 555-0148"), "formatted number should be visible");
  assert.ok(html.includes("Copy"), "copy affordance should exist");
});

test("touch devices get real sms: and tel: links", () => {
  const html = render({ pointerCoarse: true });
  assert.ok(html.includes('href="sms:+13105550148?body='), "sms deeplink");
  assert.ok(html.includes('href="tel:+13105550148"'), "tel deeplink");
  assert.ok(html.includes("wa.me/13105550148"), "whatsapp link");
});

test("desktop replaces the dead links with copy actions, never a disabled control", () => {
  const html = render({ pointerCoarse: false });
  assert.ok(!html.includes('href="sms:'), "no sms: link on a fine pointer");
  assert.ok(!html.includes('href="tel:'), "no tel: link on a fine pointer");
  assert.ok(html.includes("Copy to text"), "offers the working alternative");
  assert.ok(html.includes("Copy to call"));
  assert.ok(!html.includes("disabled"), "a disabled button would misstate what is possible");
  // WhatsApp Web works on desktop, so that one stays a real link.
  assert.ok(html.includes("wa.me/13105550148"));
});

test("the preview shows exactly the body the links carry", () => {
  const html = render();
  assert.ok(html.includes("Hi Alex \u2014 Paul here from the Men&#x27;s 4.0 Fall Flex 2026."));
  const encoded = encodeURIComponent("Hi Alex \u2014 Paul here from the Men's 4.0 Fall Flex 2026.");
  assert.ok(html.includes(encoded.slice(0, 40)), "the same text is encoded into the link");
});

test("availability appears in the preview only when supplied", () => {
  assert.ok(!render().includes("usually free"));
  assert.ok(render({ senderAvailability: "weekday evenings" }).includes("usually free weekday evenings"));
});

test("the in-app route is always offered", () => {
  assert.ok(render().includes("Propose a match in app"));
});

test("an unusable number renders nothing at all", () => {
  // Better to show no sheet than a sheet with a broken tel: link.
  assert.equal(render({ phone: "not a number" }), "");
  assert.equal(render({ phone: "" }), "");
});
