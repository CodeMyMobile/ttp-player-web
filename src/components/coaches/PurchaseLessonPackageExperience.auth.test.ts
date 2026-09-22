import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./PurchaseLessonPackageExperience.tsx", import.meta.url), "utf8");

test("logged-out package checkout has an actionable auth return path", () => {
  assert.match(source, /useNavigate/);
  assert.match(source, /handleAuthRedirect/);
  assert.match(source, /pathname:\s*location\.pathname/);
  assert.match(source, /search:\s*location\.search/);
  assert.match(source, /hash:\s*location\.hash/);
  assert.match(source, /Sign in to reserve package/);
  assert.doesNotMatch(source, /disabled=\{processingPurchase \|\| isAddingNewCard \|\| !authToken\}/);
});
