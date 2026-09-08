import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const DIST = new URL("../dist/", import.meta.url);

/**
 * These used to assert against a coach with the slug "short". The completeness gate
 * withholds sub-25-word bios from the build entirely, so that page stopped existing and
 * the pair went stale together — one failing on a missing file, the other passing
 * vacuously because a URL that is never built is trivially absent from the sitemap.
 *
 * Derived from the built output instead, so they hold whoever is on the roster.
 */
const profiles = async () => {
  const entries = await readdir(new URL("coaches/", DIST), { withFileTypes: true });
  const out = [];
  for (const entry of entries.filter((candidate) => candidate.isDirectory())) {
    out.push({
      slug: entry.name,
      html: await readFile(new URL(`coaches/${entry.name}/index.html`, DIST), "utf8"),
    });
  }
  return out;
};

test("a profile is in the sitemap exactly when it is indexable", async () => {
  const sitemap = await readFile(new URL("sitemap-0.xml", DIST), "utf8");
  const pages = await profiles();
  assert.ok(pages.length > 0, "no coach profiles built");

  const wrong = pages
    .map((page) => ({
      slug: page.slug,
      noindex: /name="robots"[^>]*content="[^"]*noindex/.test(page.html),
      listed: sitemap.includes(`/coaches/${page.slug}/`),
    }))
    .filter((page) => page.noindex === page.listed);

  assert.deepEqual(wrong, [], `sitemap disagrees with the page's own robots tag: ${JSON.stringify(wrong)}`);
});

test("every profile names at least one court", async () => {
  // The completeness gate requires an approved court, so a profile with none means the
  // gate and the template disagree about what a publishable coach is.
  const pages = await profiles();
  const empty = pages.filter((page) => !/Where .* coaches/.test(page.html)).map((page) => page.slug);
  assert.deepEqual(empty, []);
});
