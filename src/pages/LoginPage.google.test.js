import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./LoginPage.jsx", import.meta.url), "utf8");

test("Google login uses rendered GIS button instead of One Tap prompt", () => {
  assert.match(source, /accounts\.id\.renderButton/);
  assert.doesNotMatch(source, /accounts\.id\.prompt/);
});
