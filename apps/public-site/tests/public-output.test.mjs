import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("build emits homepage SEO metadata from the apex domain", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>Tennis Coaches &amp; Community in West LA \| The Tennis Plan<\/title>/);
  assert.match(html, /name="description" content="Find certified tennis coaches, players, and flexible leagues in West Los Angeles with The Tennis Plan\."/);
  assert.match(html, /rel="canonical" href="https:\/\/thetennisplan\.com\/"/);
  assert.match(html, /property="og:url" content="https:\/\/thetennisplan\.com\/"/);
  assert.match(html, /name="robots" content="index, follow"/);
  const head = html.slice(0, html.indexOf("</head>"));
  assert.doesNotMatch(head, /app\.thetennisplan\.com/);
});

test("build emits the public landing content and account boundaries", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");

  assert.match(html, /<h1[^>]*>\s*Find your tennis <span[^>]*>community\.<\/span>\s*<\/h1>/);
  assert.match(html, /Browse coaches before you sign up/);
  assert.match(html, /See who's free to play/);
  assert.match(html, /Track matches and climb/);
  assert.match(html, /href="\/tennis-coaches"/);
  // Inverted deliberately. 2c077f9 pointed the auth links at the app root and locked that in
  // here, but the root renders the app's own landing page when logged out — no sign-in form —
  // so "Sign in" led to a second landing page rather than a login. /login is the route with
  // the email and password fields, and AuthRedirectRoute still bounces a signed-in user to
  // their dashboard, so returning users keep the behaviour that commit wanted. The edge
  // function is what actually routes returning users, and it only runs on "/" — unaffected.
  assert.match(html, /href="https:\/\/app\.thetennisplan\.com\/#\/login"/);
  assert.doesNotMatch(html, /href="https:\/\/app\.thetennisplan\.com\/#\/"/);
  assert.match(html, /alt="/);
});

test("build renders a decorative shield-check icon for the coach trust band", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");

  assert.match(html, /<svg[^>]*class="landing-trust__shield"[^>]*aria-hidden="true"[^>]*>/);
  assert.match(html, /<path[^>]*d="M12 22/);
  assert.doesNotMatch(html, /landing-trust__icon[^>]*>♜/);
});

test("build emits an apex-domain crawler policy and sitemap", async () => {
  const robots = await readFile(new URL("../dist/robots.txt", import.meta.url), "utf8");
  const sitemap = await readFile(new URL("../dist/sitemap-0.xml", import.meta.url), "utf8");

  assert.match(robots, /Allow: \/\n/);
  assert.match(robots, /Sitemap: https:\/\/thetennisplan\.com\/sitemap-index\.xml/);
  assert.doesNotMatch(robots, /app\.thetennisplan\.com/);
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.ok(locations.includes("https://thetennisplan.com/"));
  assert.ok(locations.includes("https://thetennisplan.com/tennis-coaches/"));
  assert.ok(locations.includes("https://thetennisplan.com/about/"));
  assert.doesNotMatch(sitemap, /\/coaches\/short\//);
});
