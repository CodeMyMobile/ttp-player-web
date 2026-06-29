import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./AuthContext.jsx", import.meta.url), "utf8");

test("auth provider reacts when authToken changes in storage", () => {
  assert.match(source, /addEventListener\("storage"/);
  assert.match(source, /event\?\.key === "authToken"/);
  assert.match(source, /setIsAuthenticated\(Boolean\(token\)\)/);
});
