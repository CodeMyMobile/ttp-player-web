import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("build emits homepage SEO metadata from the apex domain", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>Tennis Coaches & Community in West LA \| The Tennis Plan<\/title>/);
  assert.match(html, /name="description" content="Find certified tennis coaches, players, and flexible leagues in West Los Angeles with The Tennis Plan\."/);
  assert.match(html, /rel="canonical" href="https:\/\/thetennisplan\.com\/"/);
  assert.match(html, /property="og:url" content="https:\/\/thetennisplan\.com\/"/);
  assert.match(html, /name="robots" content="index, follow"/);
  const head = html.slice(0, html.indexOf("</head>"));
  assert.doesNotMatch(head, /app\.thetennisplan\.com/);
});

test("build emits an apex-domain crawler policy and sitemap", async () => {
  const robots = await readFile(new URL("../dist/robots.txt", import.meta.url), "utf8");
  const sitemap = await readFile(new URL("../dist/sitemap-0.xml", import.meta.url), "utf8");

  assert.match(robots, /Allow: \/\n/);
  assert.match(robots, /Sitemap: https:\/\/thetennisplan\.com\/sitemap-index\.xml/);
  assert.deepEqual(
    [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]),
    ["https://thetennisplan.com/"],
  );
});
