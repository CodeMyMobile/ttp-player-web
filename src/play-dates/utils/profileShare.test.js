import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPlayerProfileShareUrl,
  getProfileShareUserId,
} from "./profileShare.js";

test("profile share id prefers user_id over personal detail row id", () => {
  const personalDetails = {
    id: 1,
    user_id: 6,
    full_name: "Paul Cochrane",
  };

  assert.equal(getProfileShareUserId({ profile: personalDetails }), 6);
  assert.equal(
    buildPlayerProfileShareUrl(
      getProfileShareUserId({ profile: personalDetails }),
      "https://app.example.com/",
    ),
    "https://app.example.com/#/player/profile/6",
  );
});
