#!/usr/bin/env node
/**
 * Route smoke test — "does the page exist", nothing deeper.
 *
 * On 2026-08-29 /find-players rendered a blank page in production for 106 minutes.
 * The build passed, 479 unit tests passed, the linter passed, and component render
 * harnesses passed — because none of them load a route. Two runtime errors were enough
 * to unmount the whole tree, and nothing noticed until a person looked.
 *
 * So this is deliberately shallow. It asserts only that each route mounts something,
 * throws nothing, and is not an empty shell. It is not a behaviour test and should not
 * grow into one: the value is that it is cheap enough to run on every PR and after
 * every production deploy, and specific enough that a failure means "this page is
 * down" rather than "something changed".
 *
 * Fixtures carry NO absolute dates. A hardcoded date is what expired the
 * coach-availability test — green the morning it was written, red by the evening.
 *
 * Usage:
 *   node scripts/smoke-routes.mjs <base-url>
 *   node scripts/smoke-routes.mjs <base-url> --measure
 *
 * --measure additionally reports the chrome height above the first player card, in the
 * SIGNED-IN state. It lives here rather than in a separate script so there is one
 * browser harness to trust and one place to fix if it lies.
 *
 * Signed-in measurement only works against localhost. Google Sign-In allows
 * app.thetennisplan.com and localhost:5173 as origins, and no deploy-preview hostname
 * will ever be on that list — so a preview can only ever show the signed-out
 * projection, which is not the state the curated header and ranking live in.
 */
// playwright-core carries no browsers. Locally it uses the installed Chrome via
// channel; in CI the workflow installs chromium first.
import { chromium } from "playwright-core";

const base = (process.argv[2] || "http://localhost:5173").replace(/\/+$/, "");

/**
 * Hash routes render client-side; /s/* is server-rendered by the edge function and
 * publicly reachable, so it is checked as a real path rather than a fragment.
 */
const ROUTES = [
  { path: "/#/", name: "home", minText: 200 },
  { path: "/#/find-players", name: "find players", minText: 120 },
  { path: "/#/players/26", name: "player profile", minText: 80 },
  { path: "/#/settings/match-profile", name: "match profile", minText: 80 },
  { path: "/#/match-results", name: "ladder", minText: 200 },
  { path: "/s/coach/26", name: "coach share", minText: 0, serverRendered: true },
  { path: "/s/match/26", name: "match share", minText: 0, serverRendered: true },
];

/**
 * Noise that says nothing about whether the page mounted.
 *
 * "Failed to load resource" is the browser's console message for ANY non-2xx
 * subresource, so a 404 from the API lands here. That is a data condition, not a page
 * condition — and a route that renders an empty state for a missing entity is still a
 * route that exists. Uncaught exceptions (pageerror) are never ignored, because those
 * are what unmount the tree.
 *
 * The ids below are placeholders on purpose. The test asserts the page mounts whether
 * or not the entity exists, which is more durable than an id with a shelf life.
 */
const IGNORABLE = [
  /GeolocationPositionError/i,
  /Failed to detect current location/i,
  /ResizeObserver loop/i,
  /Failed to load resource/i,
  /net::ERR_/i,
  /favicon/i,
];

/**
 * Google Sign-In errors on anything that is not a registered origin, and only
 * app.thetennisplan.com and localhost:5173 are registered in the Google console. A
 * local checkout has no VITE_GOOGLE_CLIENT_ID at all, and every deploy-preview URL is
 * a new hostname that will never be on the list.
 *
 * So it is ignored on localhost and on previews — where it is a fact about the
 * environment, not the page — and left fatal in production, where a GSI error would be
 * a real sign-in outage.
 */
const isNonProdOrigin =
  /^https?:\/\/(localhost|127\.0\.0\.1)/.test(base) || /deploy-preview-\d+--/.test(base);
if (isNonProdOrigin) IGNORABLE.push(/GSI_LOGGER/i);

const browser = await chromium.launch(
  process.env.CI ? { headless: true } : { channel: "chrome", headless: true },
);
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

const results = [];
for (const route of ROUTES) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).split("\n")[0]));
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORABLE.some((r) => r.test(m.text()))) {
      errors.push(m.text().slice(0, 160));
    }
  });

  let outcome;
  try {
    await page.goto(`${base}${route.path}`, { waitUntil: "load", timeout: 30000 });
    // Client routes need a beat to mount; server-rendered ones are already there.
    await page.waitForTimeout(route.serverRendered ? 500 : 3500);
    outcome = await page.evaluate(() => ({
      rootChildren: document.getElementById("root")?.children.length ?? null,
      bodyChildren: document.body.children.length,
      textLength: (document.body.innerText || "").trim().length,
      title: document.title,
    }));
  } catch (error) {
    outcome = { failed: String(error).split("\n")[0] };
  }
  await page.close();

  const mounted = route.serverRendered
    ? Boolean(outcome.title) && outcome.bodyChildren >= 0 && !outcome.failed
    : (outcome.rootChildren ?? 0) > 0;
  const enoughText = (outcome.textLength ?? 0) >= route.minText;
  const clean = errors.length === 0;

  results.push({ ...route, ...outcome, mounted, enoughText, clean, errors });
}

/* ------------------------------------------------------------------- measure */

if (process.argv.includes("--measure")) {
  const page = await context.newPage();

  // A session and a match profile, seeded rather than signed in: the point is to render
  // the member state, not to exercise auth. No absolute dates anywhere.
  await page.addInitScript(() => {
    localStorage.setItem("authToken", "token smoke-measurement");
    // Find Players shows a "location required" state without these, and never reaches
    // the results at all.
    localStorage.setItem("player:web:user-location", JSON.stringify({ latitude: 34.0, longitude: -118.45 }));
    localStorage.setItem("player:web:user-location-label", "Venice, CA");
    localStorage.setItem(
      "player:web:match-profile",
      JSON.stringify({
        about: "Weekend hitter",
        level: "4.0",
        playStyles: ["Singles"],
        gender: "Female",
        localCourts: "Penmar Recreation Center",
        availability: ["Weekdays AM", "Weekends"],
      }),
    );
  });

  const roster = Array.from({ length: 12 }, (_, i) => ({
    userId: 100 + i,
    full_name: `Player ${i + 1}`,
    email: `p${i}@example.test`,
    skillLevel: ["NTRP 4.0", "NTRP 4.5", "NTRP 3.5"][i % 3],
    availability: ["Weekdays AM", "Weekends"],
    lookingFor: ["Singles"],
    gender: i % 2 ? "female" : "male",
    playerLocations: ["Penmar Recreation Center 1341 Lake St, Venice, CA"],
    playerCourtLocations: ["Penmar Recreation Center"],
    about_me: "Been playing since college, looking for weekend hits.",
    isLevelConfirmed: i % 2 === 0,
    verifiedLevelCount: i % 2 === 0 ? 5 : 0,
    profile_picture: "",
  }));

  // Predicate, not a glob: "**/api/**" also matches Vite's own /src/api/* modules and
  // would serve the app's JavaScript as JSON.
  await page.route(
    (url) => /getchecklocation|\/surveys\/(answered|questions)/.test(url.pathname),
    (route) =>
      route.fulfill({
        json: /getchecklocation/.test(route.request().url()) ? roster : { questions: [] },
      }),
  );

  await page.goto(`${base}/#/find-players`, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(4000);

  const m = await page.evaluate(() => {
    const card = document.querySelector(".fp-card");
    const rows = [...document.querySelectorAll(".fp-controls,.fp-chips,.fp-result-bar,.fp-prompt-header")];
    return {
      cards: document.querySelectorAll(".fp-card").length,
      chromeAboveFirstCard: card ? Math.round(card.getBoundingClientRect().top + scrollY) : null,
      stamp: document.querySelector(".curated-stamp")?.innerText.replace(/\n/g, " | ") ?? null,
      topPickFlag: document.querySelector(".fp-card__flag")?.innerText ?? null,
      promptHeader: document.querySelector(".fp-prompt-header") !== null,
      verdicts: [...document.querySelectorAll(".fp-card__verdict")].slice(0, 3).map((e) => e.innerText),
      wrapped: rows
        .filter((r) => {
          const kids = [...r.children];
          if (kids.length < 2) return false;
          return (
            Math.round(r.getBoundingClientRect().height) >
            Math.round(Math.max(...kids.map((k) => k.getBoundingClientRect().height))) + 4
          );
        })
        .map((r) => r.className.split(" ")[0]),
      bodyScrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      // Where the chrome height actually goes, so the total can be judged rather than
      // just met.
      breakdown: [
        ".fc-header", ".fp-controls", ".fp-chips", ".fp-result-bar", ".fp-prompt-header",
      ].reduce((acc, sel) => {
        const el = document.querySelector(sel);
        if (el) acc[sel] = Math.round(el.getBoundingClientRect().height);
        return acc;
      }, {}),
    };
  });

  console.log("\nFold measurement (signed-in, 390x844)\n");
  for (const [k, v] of Object.entries(m)) console.log(`  ${k}: ${JSON.stringify(v)}`);
  await page.close();
}

await browser.close();

let failed = 0;
console.log(`\nRoute smoke test — ${base}\n`);
for (const r of results) {
  const ok = r.mounted && r.enoughText && r.clean;
  if (!ok) failed += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${r.name.padEnd(16)} ${r.path}`);
  if (!ok) {
    if (r.failed) console.log(`          navigation failed: ${r.failed}`);
    if (!r.mounted) console.log(`          nothing mounted (#root children: ${r.rootChildren})`);
    if (!r.enoughText) console.log(`          shell is empty: ${r.textLength} chars, floor is ${r.minText}`);
    for (const e of r.errors) console.log(`          error: ${e}`);
  }
}

console.log(failed ? `\n${failed} of ${results.length} routes are down.\n` : `\nAll ${results.length} routes render.\n`);
process.exit(failed ? 1 : 0);
