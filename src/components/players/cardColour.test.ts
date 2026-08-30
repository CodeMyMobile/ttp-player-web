import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

/**
 * One green on the card, and it is the court line. Asserted against the stylesheet
 * because it is a semantic rule, not a taste call: a hedged verdict on a green ground
 * reads as affirmative, which inverts the one thing the hedge exists to do.
 */
const css = readFileSync(new URL("./players.css", import.meta.url), "utf8");

const ruleFor = (selector: string) => {
  const i = css.indexOf(`${selector} {`);
  assert.notEqual(i, -1, `${selector} should exist`);
  return css.slice(i, css.indexOf("}", i));
};

test("no verdict chip is ever green", () => {
  for (const tone of ["even", "up", "down"]) {
    const rule = ruleFor(`.fp-card__verdict--${tone}`);
    assert.doesNotMatch(rule, /--fc-color-good/, `${tone} verdict must not use the good tokens`);
  }
});

test("the rating tick is not green — it means checked, not good", () => {
  assert.doesNotMatch(ruleFor(".fp-card__rating-tick"), /--fc-color-good/);
});

test("the court line keeps the green, and it is the only one", () => {
  assert.match(ruleFor(".fp-card__court.is-shared"), /--fc-color-good/);
});

test("the photo carries no tick", () => {
  assert.doesNotMatch(css, /\.fp-card__photo-tick/);
});

test("the curated stamp carries no accent colour", () => {
  const stamp = readFileSync(new URL("../CuratedStamp.css", import.meta.url), "utf8");
  assert.doesNotMatch(stamp, /--fc-color-accent/);
  assert.match(stamp, /--fc-color-seal/);
});
