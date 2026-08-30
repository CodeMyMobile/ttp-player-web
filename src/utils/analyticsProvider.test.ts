import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

/**
 * The PostHog defaults are the part of this that could leak, and they leak independently
 * of our own event schema — autocapture records the TEXT of what was clicked, which on
 * Find Players is player names. These are asserted against the source rather than by
 * booting the SDK, because the option values are the contract.
 */
const source = readFileSync(new URL("./analyticsProvider.ts", import.meta.url), "utf8");

test("every capture-by-default behaviour is disabled", () => {
  for (const [option, value] of [
    ["autocapture", "false"],
    ["capture_pageview", "false"],
    ["capture_pageleave", "false"],
    ["disable_session_recording", "true"],
  ]) {
    assert.match(
      source,
      new RegExp(`${option}:\\s*${value}`),
      `${option} must be ${value} — the default would send data our schema never approved`,
    );
  }
});

test("URL-bearing properties are scrubbed to origin and path", () => {
  // The app is hash-routed, so the fragment carries player and coach ids — and on other
  // routes, password-reset and payment tokens.
  assert.match(source, /sanitize_properties/);
  assert.match(source, /SENSITIVE_KEYS\s*=\s*\/.*url.*href/i);
  assert.match(source, /\$\{url\.origin\}\$\{url\.pathname\}/);
});

test("no key means no provider, so track stays a no-op", () => {
  assert.match(source, /if \(!key\) \{[\s\S]*?return;/);
});

test("no debugging hooks are left on window", () => {
  assert.doesNotMatch(source, /window as unknown|__analyticsReady|__lastEvent/);
});
