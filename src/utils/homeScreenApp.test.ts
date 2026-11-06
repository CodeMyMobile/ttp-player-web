import test from "node:test";
import assert from "node:assert/strict";

import { isAppleMobile, isAppleMobileBrowser, isHomeScreenApp } from "./homeScreenApp";

const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1";
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";

const notStandalone = () => ({ matches: false });
const standalone = () => ({ matches: true });

test("Chrome and Safari on an iPhone are the browser case", () => {
  assert.equal(isAppleMobileBrowser({ userAgent: IPHONE_CHROME }, notStandalone), true);
  assert.equal(isAppleMobileBrowser({ userAgent: IPHONE_SAFARI }, notStandalone), true);
});

test("an iPad posing as a Mac counts; a real Mac doesn't", () => {
  assert.equal(isAppleMobile({ userAgent: MAC_SAFARI, platform: "MacIntel", maxTouchPoints: 5 }), true);
  assert.equal(isAppleMobile({ userAgent: MAC_SAFARI, platform: "MacIntel", maxTouchPoints: 0 }), false);
});

test("the home-screen app itself isn't the browser case", () => {
  assert.equal(isAppleMobileBrowser({ userAgent: IPHONE_SAFARI, standalone: true }, notStandalone), false);
  assert.equal(isAppleMobileBrowser({ userAgent: IPHONE_SAFARI }, standalone), false);
  assert.equal(isHomeScreenApp({ userAgent: IPHONE_SAFARI }, null), false);
});

test("Android and desktop aren't the iPhone case", () => {
  assert.equal(isAppleMobileBrowser({ userAgent: ANDROID_CHROME }, notStandalone), false);
  assert.equal(isAppleMobileBrowser(undefined, null), false);
});
