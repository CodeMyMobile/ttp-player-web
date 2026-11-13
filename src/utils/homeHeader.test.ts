import assert from "node:assert/strict";
import test from "node:test";

import { greetingFor, homeAreaLabel } from "./homeHeader";

test("greets by the time of day", () => {
  assert.equal(greetingFor(new Date(2026, 10, 13, 8)), "Good morning");
  assert.equal(greetingFor(new Date(2026, 10, 13, 13)), "Good afternoon");
  assert.equal(greetingFor(new Date(2026, 10, 13, 19)), "Good evening");
});

test("the pill shows the short area, else the first part of the label, else nothing", () => {
  assert.equal(homeAreaLabel({ area: "West LA", label: "Los Angeles, CA, USA" }), "West LA");
  assert.equal(homeAreaLabel({ area: null, label: "Culver City, CA, USA" }), "Culver City");
  assert.equal(homeAreaLabel({ area: " ", label: null }), null);
});
