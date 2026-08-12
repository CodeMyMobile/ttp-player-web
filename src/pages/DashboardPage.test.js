import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./DashboardPage.jsx", import.meta.url), "utf8");

test("My Schedule preserves parsed lesson offset instead of formatting native Date", () => {
  assert.match(
    source,
    /const displayStart = zonedStart \?\? moment\(startAt\);/,
  );
  assert.doesNotMatch(
    source,
    /const displayStart = type === "group" && startSource \? moment\.utc\(startSource\) : moment\(startAt\);/,
  );
});
