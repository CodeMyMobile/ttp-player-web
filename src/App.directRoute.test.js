import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("direct pay route yields to hash router navigation after header links are clicked", () => {
  assert.match(source, /hashPath/);
  assert.match(source, /hasHashRoute/);
  assert.match(source, /!hasHashRoute && window\.location\.pathname\.match\(\/\^\\\/pay/);
  assert.match(source, /!hasHashRoute && window\.location\.pathname\.match\(\/\^\\\/\(\[\^/);
});
