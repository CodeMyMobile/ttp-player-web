import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const DIST = new URL("../dist/", import.meta.url);

const htmlFiles = async (dir = DIST) => {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
    if (entry.isDirectory()) found.push(...(await htmlFiles(child)));
    else if (entry.name.endsWith(".html")) found.push(child);
  }
  return found;
};

const exists = async (relative) => {
  // A route is served either as dist/<route>/index.html or as a literal dist/<file>.
  // Relative, never leading-slash: `new URL("/index.html", DIST)` resolves against the
  // filesystem root rather than dist, so "/" would look for /index.html and always miss.
  const clean = relative.replace(/^\/+/, "").replace(/\/+$/, "");
  const candidates = clean ? [`${clean}/index.html`, clean] : ["index.html"];
  for (const candidate of candidates) {
    try {
      await readFile(new URL(candidate, DIST));
      return true;
    } catch {}
  }
  return false;
};

/**
 * Three "Browse coaches" links on the landing page pointed at /find-coaches, which is a
 * route in the React app and has never been a page on this site — they served Astro's 404
 * in production. The existing homepage test asserted /tennis-coaches appeared somewhere in
 * the HTML, which the hero link satisfied on its own, so it passed the whole time.
 *
 * This walks every internal href in the built output instead of naming the ones we
 * remember, because the next dead link will be somewhere we did not think to assert.
 */
test("every internal link resolves to a built page", async () => {
  const pages = await htmlFiles();
  assert.ok(pages.length > 0, "no built HTML found — run the build first");

  const dead = [];
  for (const page of pages) {
    const html = await readFile(page, "utf8");
    const source = path.relative(DIST.pathname, page.pathname);
    for (const [, href] of html.matchAll(/href="(\/[^"#?]*)"/g)) {
      if (href.startsWith("//")) continue;
      if (/\.(xml|txt|ico|png|jpe?g|svg|webp|css|js|json|webmanifest)$/.test(href)) continue;
      if (!(await exists(href))) dead.push(`${source} → ${href}`);
    }
  }

  assert.deepEqual(dead, [], `dead internal links:\n  ${dead.join("\n  ")}`);
});
