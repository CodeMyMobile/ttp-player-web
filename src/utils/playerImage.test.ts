import assert from "node:assert/strict";
import { test } from "node:test";

import { handleImageTransformError, originalImageUrl, sizedImageUrl } from "./playerImage";

// import.meta.env.PROD is false under the test runner, so these cover the dev
// pass-through path — the transform itself is asserted by shape below.

test("empty and non-string sources produce nothing", () => {
  assert.equal(sizedImageUrl("", { size: 48 }), "");
  assert.equal(sizedImageUrl("   ", { size: 48 }), "");
  assert.equal(sizedImageUrl(null, { size: 48 }), "");
  assert.equal(sizedImageUrl(undefined, { size: 48 }), "");
});

test("outside production the source is passed through untouched", () => {
  const src = "https://ttp-avatars-production.s3.amazonaws.com/26-9138013.jpeg";
  assert.equal(sizedImageUrl(src, { size: 48 }), src);
});

test("relative paths and data URIs are never rewritten", () => {
  assert.equal(sizedImageUrl("/og-image.png", { size: 48 }), "/og-image.png");
  assert.equal(sizedImageUrl("data:image/png;base64,AAA", { size: 48 }), "data:image/png;base64,AAA");
});

test("a scheme the CDN cannot handle is returned untouched", () => {
  assert.equal(sizedImageUrl("blob:abc-123", { size: 48 }), "blob:abc-123");
  assert.equal(sizedImageUrl("ftp://host/a.jpg", { size: 48 }), "ftp://host/a.jpg");
});

test("originalImageUrl gives back the untransformed source", () => {
  const src = "https://ttp-avatars-production.s3.amazonaws.com/26.jpeg";
  assert.equal(originalImageUrl(` ${src} `), src);
  assert.equal(originalImageUrl(null), "");
});

test("a failed transform falls back to the original exactly once", () => {
  const src = "https://ttp-avatars-production.s3.amazonaws.com/26.jpeg";
  const node = { src: "/.netlify/images?url=…", dataset: {} } as unknown as HTMLImageElement;

  handleImageTransformError({ currentTarget: node }, src);
  assert.equal(node.src, src, "swaps to the original");

  // A broken original would otherwise loop: error -> set src -> error -> set src.
  node.src = "/.netlify/images?url=…";
  handleImageTransformError({ currentTarget: node }, src);
  assert.equal(node.src, "/.netlify/images?url=…", "does not retry a second time");
});

test("the fallback is a no-op when there is nothing to fall back to", () => {
  const node = { src: "x", dataset: {} } as unknown as HTMLImageElement;
  handleImageTransformError({ currentTarget: node }, null);
  assert.equal(node.src, "x");
});
