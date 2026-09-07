import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("noindex coach profiles are absent from the sitemap", async () => {
  const sitemap = await readFile(new URL("../dist/sitemap-0.xml", import.meta.url), "utf8");
  assert.doesNotMatch(sitemap, /\/coaches\/short\//);
});

test("profile courts without a qualifying area page are not broken links", async () => {
  const html = await readFile(new URL("../dist/coaches/short/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /href="\/tennis-coaches\/venice"/);
  assert.match(html, /Penmar Recreation Center/);
});
