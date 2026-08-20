import assert from "node:assert/strict";
import test from "node:test";
import { extractPlayerPhoto } from "./playerPhotos";

// Shapes taken from the live /public/players/:id responses on 2026-08-20.
const BUCKET_ROOT = "https://ttp-avatars-production.s3.amazonaws.com/";
const REAL = "https://ttp-avatars-production.s3.amazonaws.com/1290-4868811.jpeg";

test("extractPlayerPhoto reads the photo out of the player envelope", () => {
  assert.equal(extractPlayerPhoto({ player: { profile_picture: REAL } }), REAL);
});

test("extractPlayerPhoto rejects the bare bucket root", () => {
  // Most players have this where a picture should be. It is a non-empty string,
  // so an unguarded check renders a broken image instead of the initials.
  assert.equal(extractPlayerPhoto({ player: { profile_picture: BUCKET_ROOT } }), null);
});

test("extractPlayerPhoto tolerates a missing photo, envelope, or payload", () => {
  assert.equal(extractPlayerPhoto({ player: {} }), null);
  assert.equal(extractPlayerPhoto({ player: { profile_picture: null } }), null);
  assert.equal(extractPlayerPhoto({ profile_picture: REAL }), REAL, "unwrapped payload still works");
  assert.equal(extractPlayerPhoto(null), null);
  assert.equal(extractPlayerPhoto("nope"), null);
});
