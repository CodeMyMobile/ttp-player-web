import assert from "node:assert/strict";
import test from "node:test";

import { usableAvatar } from "./avatar";

test("a bucket root with no key is not a picture", () => {
  // The case that renders a broken image instead of falling back to initials.
  assert.equal(usableAvatar("https://tennisplan.s3.amazonaws.com/"), null);
  assert.equal(usableAvatar("https://tennisplan.s3.amazonaws.com"), null);
  assert.equal(usableAvatar("https://cdn.example.com///"), null);
});

test("a URL pointing at an actual file is kept", () => {
  assert.equal(
    usableAvatar("https://tennisplan.s3.amazonaws.com/players/42.jpg"),
    "https://tennisplan.s3.amazonaws.com/players/42.jpg",
  );
  assert.equal(usableAvatar("https://cdn.example.com/a/b/c"), "https://cdn.example.com/a/b/c");
});

test("empty and non-string input yields null so the caller falls back", () => {
  assert.equal(usableAvatar(""), null);
  assert.equal(usableAvatar("   "), null);
  assert.equal(usableAvatar(null), null);
  assert.equal(usableAvatar(undefined), null);
  assert.equal(usableAvatar(42), null);
});

test("a relative path is left alone rather than guessed at", () => {
  assert.equal(usableAvatar("/uploads/42.jpg"), "/uploads/42.jpg");
  assert.equal(usableAvatar("avatars/42.jpg"), "avatars/42.jpg");
});
