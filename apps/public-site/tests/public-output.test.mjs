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
  assert.match(html, /href="\/what-is-my-tennis-level"[^>]*>\s*Find my tennis level/);
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
  // Still shipped in the question data the script picks up.
  assert.match(html, /data-option-id="m"/);
  assert.match(html, /"id":"lessons"/);
  // Was /"id":"c_split"/ — an option of the comparison question, which was removed
  // for being circular. The rally question stands in as the later-question check.
  assert.match(html, /"id":"r2"/);
  assert.match(html, /RATING_MODEL_VERSION/);
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

test("the quiz's pool adjustment ships unvalidated and inert", async () => {
  const html = await readFile(new URL("../dist/what-is-my-tennis-level/index.html", import.meta.url), "utf8");

  // One named term, both values zero: the question collects data without changing
  // anyone's result until the league numbers say what the shift should be.
  assert.match(html, /POOL_SHIFT = \{ m: 0, w: 0 \}/);
  assert.match(html, /UNVALIDATED/);
  // Applied once, at the end of scoring.
  assert.equal((html.match(/POOL_SHIFT\[/g) || []).length, 1);
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
  const html = await readFile(new URL("../dist/what-is-my-tennis-level/index.html", import.meta.url), "utf8");

  assert.doesNotMatch(html, /Think of someone you play often/);
  assert.doesNotMatch(html, /c_win|c_split|c_lose|c_skip/);
  assert.doesNotMatch(html, /cmp/);
});

test("the result asks for confirmation and never scores the answer", async () => {
  const html = await readFile(new URL("../dist/what-is-my-tennis-level/index.html", import.meta.url), "utf8");

  assert.match(html, /does that sound about right\?/);
  assert.match(html, /Lower than I expected/);
  assert.match(html, /Higher than I expected/);
  assert.match(html, /Want to set it to/);

  // The whole point of the confirmation is that it is recorded, not applied. The
  // scorer must not read it: the only thing that moves the level is the player
  // explicitly taking the offered half step.
  const scorer = html.slice(html.indexOf("function score()"), html.indexOf("function activeQuestions()"));
  assert.ok(scorer.length > 100, "found the scoring function in the built output");
  assert.doesNotMatch(scorer, /feedback/);
  assert.doesNotMatch(scorer, /accepted/);
});

/**
 * The guard for the defect that made this test worth writing.
 *
 * `weights[answers[key]] || 0` cannot tell a deliberate zero from a missing entry.
 * The rally answers had no entries at all, so a question the page calls the clearest
 * separator of levels scored nothing from the day it shipped — silently, because
 * undefined and "worth zero" look identical to the scorer.
 *
 * This reads the question set and the weights out of the built page and asserts that
 * every answer the scorer will look up is actually in the table. An incomplete table
 * fails the build instead of quietly mis-calibrating everyone.
 */
test("every scored quiz answer has a weight", async () => {
  const html = await readFile(new URL("../dist/what-is-my-tennis-level/index.html", import.meta.url), "utf8");

  const questions = JSON.parse(html.match(/const quizQuestions = (\[.*?\]);/s)[1]);
  const keysOf = (literal) => [...literal.matchAll(/([A-Za-z_][\w]*)\s*:/g)].map((m) => m[1]);
  const weights = new Set(keysOf(html.match(/const weights = \{(.*?)\};/s)[1]));
  const declared = new Set(keysOf(html.match(/const declared = \{(.*?)\};/s)[1]));
  const scored = new Set(Object.keys(JSON.parse(`{${html.match(/const coefficients = \{(.*?)\};/s)[1].replace(/(\w+):/g, '"$1":')}}`)));

  // Answers that route rather than score: two exits from the background question,
  // and the pool question, which picks a calibration rather than adding to the total.
  const ROUTES = new Set(["starting", "usta"]);

  for (const question of questions) {
    for (const option of question.options) {
      if (question.key === "pool") continue;
      if (question.key === "usta") {
        assert.ok(declared.has(option.id), `declared rating "${option.id}" has no level`);
        continue;
      }
      if (ROUTES.has(option.id)) continue;
      assert.ok(
        weights.has(option.id),
        `answer "${option.id}" on question "${question.key}" has no entry in weights — it would score zero silently`,
      );
    }
  }

  // And the reverse: every scored question is one the question set actually asks.
  for (const key of scored) {
    assert.ok(questions.some((question) => question.key === key), `coefficient "${key}" has no question`);
  }
});

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
