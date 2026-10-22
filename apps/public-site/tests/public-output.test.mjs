import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * The quiz page's HTML plus the scripts it loads. Its questions and scoring come from the
 * shared model (src/features/ratingQuiz/ratingQuizModel.ts) and ship in a bundled script,
 * so what used to be checked in the page's inline source is checked in that bundle.
 */
const readQuizPage = async () => {
  const html = await readFile(new URL("../dist/what-is-my-tennis-level/index.html", import.meta.url), "utf8");
  const sources = [...html.matchAll(/<script[^>]*\bsrc="(\/_astro\/[^"]+\.js)"/g)].map((match) => match[1]);
  const scripts = await Promise.all(sources.map((src) => readFile(new URL(`../dist${src}`, import.meta.url), "utf8")));
  return { html, script: scripts.join("\n") };
};

test("build emits homepage SEO metadata from the apex domain", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>Tennis Coaches &amp; Community in West LA \| The Tennis Plan<\/title>/);
  assert.match(html, /name="description" content="Find certified tennis coaches, players, and flexible leagues in West Los Angeles with The Tennis Plan\."/);
  assert.match(html, /rel="canonical" href="https:\/\/thetennisplan\.com\/"/);
  assert.match(html, /property="og:url" content="https:\/\/thetennisplan\.com\/"/);
  assert.match(html, /property="og:image" content="https:\/\/thetennisplan\.com\/og-image\.png"/);
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /property="og:image:height" content="630"/);
  assert.match(html, /property="og:image:alt" content="The Tennis Plan: Find your tennis community\."/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /name="twitter:title" content="Tennis Coaches &amp; Community in West LA \| The Tennis Plan"/);
  assert.match(html, /name="twitter:description" content="Find certified tennis coaches, players, and flexible leagues in West Los Angeles with The Tennis Plan\."/);
  assert.match(html, /name="twitter:image" content="https:\/\/thetennisplan\.com\/og-image\.png"/);
  await readFile(new URL("../dist/og-image.png", import.meta.url));
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
  assert.match(html, /href="\/what-is-my-tennis-level"[^>]*>\s*Find my tennis level/);
  assert.match(html, /href="\/whats-on"[^>]*>\s*See what's on/);
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

test("build emits the public tennis level quiz route", async () => {
  const html = await readFile(
    new URL("../dist/what-is-my-tennis-level/index.html", import.meta.url),
    "utf8"
  );

  assert.match(html, /<title>What&#39;s My Tennis Level\? Free NTRP Rating Quiz \| The Tennis Plan<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/thetennisplan\.com\/what-is-my-tennis-level"/);
  // The served card is question one, which is now the pool question — the background
  // question moved to second when the quiz started asking which scale to estimate on.
  assert.match(html, /data-question-key="pool"/);
  assert.match(html, /data-option-id="m"/);
  // The later questions ship in the shared model, bundled into the page's script.
  const { script } = await readQuizPage();
  // Minified, so the quotes may be any of the three.
  assert.match(script, /id:["'`]lessons["'`]/);
  assert.match(script, /id:["'`]r2["'`]/);
  assert.match(script, /rating_model_version:3/);
  assert.match(html, /FAQPage/);
  assert.doesNotMatch(html, /PATCH \/player\/personal_details/);
});

/**
 * The level quiz asks which tennis someone plays before estimating, because NTRP is
 * calibrated separately for men's and women's play. These assert the served HTML,
 * not the script: the question and the FAQ answer have to be there for a crawler
 * and for a visitor with JavaScript off.
 */
test("the level quiz asks the pool question first, in the served HTML", async () => {
  const html = await readFile(new URL("../dist/what-is-my-tennis-level/index.html", import.meta.url), "utf8");

  assert.match(html, /Which do you play\?/);
  assert.match(html, /calibrated separately for men&#39;s and women&#39;s play/);
  // The served card's counter is derived from the question set, which is why it
  // tracks changes to that set instead of going stale the way a literal "1 of 5"
  // did. Five again now that the comparison question is gone: pool, background,
  // frequency, serve, rally.
  assert.match(html, /1 of 5/);
  assert.doesNotMatch(html, /Five questions/);
  assert.doesNotMatch(html, /5 questions/);
});

/**
 * The quiz once lived in this page's inline script, and the app's copy drifted from it:
 * same version number, different weights, so 71% of answers scored higher in the app.
 * Both now use the shared model. This keeps the page from growing its own copy again.
 * The model itself (weights, the inert pool term, the scorer ignoring feedback) is
 * tested in src/features/ratingQuiz/ratingQuizModel.test.ts.
 */
test("the quiz page scores with the shared model, not a copy of its own", async () => {
  const source = await readFile(new URL("../src/pages/what-is-my-tennis-level.astro", import.meta.url), "utf8");

  assert.match(source, /from "\.\.\/\.\.\/\.\.\/\.\.\/src\/features\/ratingQuiz\/ratingQuizModel"/);
  assert.doesNotMatch(source, /const (weights|coefficients|clamps|declared|POOL_SHIFT|SCALE)\s*=/);
  assert.doesNotMatch(source, /function score\(/);
  assert.doesNotMatch(source, /is:inline define:vars=\{\{ quizQuestions/);
});

test("every FAQ answer marked up on the quiz page is on the page", async () => {
  const html = await readFile(new URL("../dist/what-is-my-tennis-level/index.html", import.meta.url), "utf8");
  const { decode } = { decode: (s) => s.replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"') };

  const visible = new Map(
    [...html.matchAll(/<dt[^>]*>(.*?)<\/dt><dd[^>]*>(.*?)<\/dd>/gs)]
      .map(([, q, a]) => [decode(q).trim(), decode(a).trim()]),
  );
  const schema = JSON.parse(html.match(/type="application\/ld\+json">(.*?)<\/script>/s)[1]);

  const question = "Is a women's 4.0 the same as a men's 4.0?";
  assert.ok(visible.has(question), "the pool FAQ entry is visible on the page");
  const marked = schema.mainEntity.find((entry) => entry.name === question);
  assert.ok(marked, "the pool FAQ entry is in the JSON-LD");
  // Structured data has to say what the page says, word for word.
  assert.equal(marked.acceptedAnswer.text, visible.get(question));
});

/**
 * The comparison question asked the player to think of someone "whose level you
 * know" and then never asked what that level was, so beating a 3.0 and beating a
 * 4.5 scored the same. It is gone, and nothing replaced it in the scoring.
 */
test("the quiz no longer scores the circular comparison question", async () => {
  const { html, script } = await readQuizPage();

  for (const shipped of [html, script]) {
    assert.doesNotMatch(shipped, /Think of someone you play often/);
    assert.doesNotMatch(shipped, /c_win|c_split|c_lose|c_skip/);
  }
});

test("the result asks for confirmation", async () => {
  // That the scorer never reads the answer is tested on the shared model.
  const { script } = await readQuizPage();

  assert.match(script, /does that sound about right\?/);
  assert.match(script, /Lower than I expected/);
  assert.match(script, /Higher than I expected/);
  assert.match(script, /Want to set it to/);
});

test("the declared-rating result doesn't count questions it didn't ask", async () => {
  const { html, script } = await readQuizPage();

  assert.match(script, /which beats anything we could estimate/);
  assert.doesNotMatch(html + script, /work out from five questions/);
});

// "Every scored quiz answer has a weight" now runs on the shared model, over every
// answer combination: src/features/ratingQuiz/ratingQuizModel.test.ts.

test("build emits the public whats-on route", async () => {
  const html = await readFile(
    new URL("../dist/whats-on/index.html", import.meta.url),
    "utf8"
  );

  assert.match(html, /<title>Tennis at Your Level in West LA \| The Tennis Plan<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/thetennisplan\.com\/whats-on"/);
  assert.match(html, /id="matches"/);
  assert.match(html, /\/api\/public\/whats-on/);
  assert.match(html, /players at your level/);
  assert.doesNotMatch(html, /Taylor Host|profile_picture|about_me|genderAdditionalText/);
});

test("whats-on sign-in links never send the app to /whats-on", async () => {
  // /whats-on is this site's page. The app read next=/whats-on as a stringer called
  // "whats-on" and showed the stringer list to everyone who signed in from here.
  const html = await readFile(new URL("../dist/whats-on/index.html", import.meta.url), "utf8");

  assert.doesNotMatch(html, /next=%2Fwhats-on/);
  assert.match(html, /href="https:\/\/app\.thetennisplan\.com\/#\/login"/);
  // Arriving from the quiz, the links hand its result to the app's save-level route.
  assert.match(html, /https:\/\/app\.thetennisplan\.com\/#\/save-level/);
});

test("the level quiz hands its result to the app", async () => {
  const { script } = await readQuizPage();

  // The minifier builds the URL from its parts, so check both.
  assert.match(script, /https:\/\/app\.thetennisplan\.com/);
  assert.match(script, /\/#\/save-level/);
  assert.match(script, /quiz:JSON\.stringify\(/);
});

test("public whats-on filters can be broadened to any value", async () => {
  const html = await readFile(
    new URL("../dist/whats-on/index.html", import.meta.url),
    "utf8"
  );

  assert.match(html, /const levels = \[\["any","Any"\]/);
  assert.match(html, /const whens = \[\["any","Any"\]/);
  assert.match(html, /const areas = \[\["any","Any"\]/);
  assert.match(html, /const divisions = \[\["any","Any"\]/);
  // "Any" sends no level at all, and a level is sent in the form the API reads.
  assert.match(html, /if \(apiLevel\(\)\) params\.set\("level", apiLevel\(\)\)/);
  assert.doesNotMatch(html, /\n\s*params\.set\("level", F\.level\);/);
});

test("whats-on filters classes and leagues by the quiz's level range", async () => {
  // The quiz links here with its band ("3.0-3.5", or "5.0+" at the top). Comparing
  // that string to a class's single level matched nothing, so arrivals from the quiz
  // saw no classes even when there were some at 3.5.
  const html = await readFile(new URL("../dist/whats-on/index.html", import.meta.url), "utf8");

  assert.doesNotMatch(html, /item\.lvl === F\.level/);
  assert.doesNotMatch(html, /item\.lvl !== F\.level/);
  assert.match(html, /\(!F\.level \|\| inLevel\(item\.lvl\)\)/);
});

/**
 * Every pillar and tile on the landing page linked to /tennis-coaches, whatever its
 * subject — the "Group lessons" pillar invited you to "Explore coaching" and took you to
 * the coach directory. The internal-link walker could never catch this: the destination
 * existed, it was just the wrong one. So this asserts where a link goes, not that it goes
 * somewhere.
 */
test("the group lessons links on the landing page reach the group lessons page", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");

  const blocks = html.split(/<article/).filter((block) => /Group lessons/.test(block));
  assert.ok(blocks.length >= 2, `expected the pillar and the tile, found ${blocks.length}`);

  for (const block of blocks) {
    const hrefs = [...block.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(
      hrefs.includes("/group-tennis-lessons"),
      `a "Group lessons" block links to ${hrefs.join(", ") || "nothing"} instead of /group-tennis-lessons`,
    );
  }
});

test("the coaching pillar still reaches the coach directory", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const pillar = html.split(/<article/).find((block) => /Learn from certified coaches/.test(block));

  assert.ok(pillar, "coaching pillar not found");
  assert.match(pillar, /href="\/tennis-coaches"/);
});
