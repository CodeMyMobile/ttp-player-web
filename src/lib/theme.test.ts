import assert from "node:assert/strict";
import { test } from "node:test";

import { warmPalette, warmPaletteDark } from "./theme";

// WCAG relative luminance and contrast ratio.
const luminance = (hex: string) => {
  const h = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const AA_NORMAL = 4.5;
const AA_LARGE = 3;

test("the accent pair is split by role because only one of them can carry text", () => {
  const onGround = (c: string) => contrast(c, warmPalette.ground);

  // This is the whole reason there are two purples rather than one.
  assert.ok(
    onGround(warmPalette.accent) < AA_NORMAL,
    `accent ${warmPalette.accent} must NOT be used for normal text (${onGround(warmPalette.accent).toFixed(2)}:1)`,
  );
  assert.ok(onGround(warmPalette.accent) >= AA_LARGE, "accent must still carry large elements");
  assert.ok(
    onGround(warmPalette.accentInk) >= AA_NORMAL,
    `accentInk ${warmPalette.accentInk} must pass AA for normal text (${onGround(warmPalette.accentInk).toFixed(2)}:1)`,
  );
});

test("every token that carries text passes AA on the ground it sits on", () => {
  const textTokens: Array<[string, string]> = [
    ["ink", warmPalette.ink],
    ["inkSecondary", warmPalette.inkSecondary],
    ["muted", warmPalette.muted],
    ["good", warmPalette.good],
    ["warm", warmPalette.warm],
    ["accentInk", warmPalette.accentInk],
  ];

  for (const [name, value] of textTokens) {
    const ratio = contrast(value, warmPalette.ground);
    assert.ok(ratio >= AA_NORMAL, `${name} (${value}) is ${ratio.toFixed(2)}:1, below AA`);
  }
});

test("faint is not a text colour and is documented as such", () => {
  // Kept deliberately: it is for decorative marks only. Asserting that it fails is
  // what stops someone reaching for it as a label colour — which is exactly what had
  // happened before this palette landed.
  assert.ok(contrast(warmPalette.faint, warmPalette.ground) < AA_NORMAL);
});

test("text on the accent fill is legible", () => {
  assert.ok(contrast(warmPalette.onAccent, warmPalette.accent) >= AA_LARGE);
});

test("the dark palette keeps the same guarantees", () => {
  const onGround = (c: string) => contrast(c, warmPaletteDark.ground);
  assert.ok(onGround(warmPaletteDark.accentInk) >= AA_NORMAL, "dark accentInk must carry text");
  for (const value of [warmPaletteDark.ink, warmPaletteDark.inkSecondary, warmPaletteDark.muted]) {
    assert.ok(onGround(value) >= AA_NORMAL, `${value} is below AA on the dark ground`);
  }
  assert.ok(contrast(warmPaletteDark.onAccent, warmPaletteDark.accent) >= AA_LARGE);
});

test("the accent pair is the brand pair, not the prototype's", () => {
  // The prototype used #6D3BEE. CLAUDE.md fixes the brand purples, and the brief says
  // brand purple is unchanged.
  assert.equal(warmPalette.accent, "#8B5CF6");
  assert.equal(warmPalette.accentInk, "#7C3AED");
});
