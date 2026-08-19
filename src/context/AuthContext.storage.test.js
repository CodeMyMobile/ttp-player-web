import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./AuthContext.jsx", import.meta.url), "utf8");

test("auth provider reacts when authToken changes in storage", () => {
  assert.match(source, /addEventListener\("storage"/);
  assert.match(source, /event\?\.key === "authToken"/);
  // The stored token alone is no longer enough — the sync path gates on the
  // token still being valid, so an expired one does not read as signed in.
  assert.match(source, /setIsAuthenticated\(Boolean\(validToken\)\)/);
});
