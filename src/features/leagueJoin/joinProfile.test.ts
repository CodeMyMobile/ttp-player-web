import assert from "node:assert/strict";
import test from "node:test";

import type { PlayerPersonalDetails } from "../../api/playerProfile";
import type { LeagueJoinPending } from "./types";
import { buildJoinProfilePatch } from "./joinProfile";

const baseProfile = (
  overrides: Partial<PlayerPersonalDetails> = {},
): PlayerPersonalDetails => ({
  gender: "male",
  usta_rating: 3.5,
  date_of_birth: "1990-05-10",
  ...overrides,
});

const basePending = (overrides: Partial<LeagueJoinPending> = {}): LeagueJoinPending => ({
  ...overrides,
});

test("buildJoinProfilePatch only sends fields that were originally missing", () => {
  const patch = buildJoinProfilePatch(
    baseProfile({
      gender: null,
      usta_rating: 3.5,
      date_of_birth: undefined,
    }),
    basePending({
      gender: "female",
      usta_rating: 4,
      date_of_birth: "1992-03-15",
    }),
  );

  assert.deepEqual(patch, {
    gender: "female",
    date_of_birth: "1992-03-15",
  });
});

test("buildJoinProfilePatch omits empty and zero-like values for missing fields", () => {
  const patch = buildJoinProfilePatch(
    baseProfile({
      gender: null,
      usta_rating: null,
      date_of_birth: null,
    }),
    basePending({
      gender: "",
      usta_rating: 0,
      date_of_birth: "   ",
    }),
  );

  assert.deepEqual(patch, {});
});

test("buildJoinProfilePatch preserves normalized alias values", () => {
  const patch = buildJoinProfilePatch(
    baseProfile({
      gender: null,
      usta_rating: null,
      date_of_birth: null,
    }),
    basePending({
      gender: "other",
      level: "4.0",
      dateOfBirth: "1998-11-02",
    }),
  );

  assert.deepEqual(patch, {
    gender: "other",
    usta_rating: "4.0",
    date_of_birth: "1998-11-02",
  });
});

test("buildJoinProfilePatch treats dob as an existing profile date of birth", () => {
  const patch = buildJoinProfilePatch(
    baseProfile({
      date_of_birth: undefined,
      dob: "1990-05-10",
    }),
    basePending({
      date_of_birth: "1992-03-15",
    }),
  );

  assert.deepEqual(patch, {});
});

test("buildJoinProfilePatch refuses to build when pending aliases disagree", () => {
  assert.equal(
    buildJoinProfilePatch(
      baseProfile({
        usta_rating: null,
      }),
      basePending({
        level: "3.5",
        usta_rating: "4.0",
      }),
    ),
    null,
  );

  assert.equal(
    buildJoinProfilePatch(
      baseProfile({
        date_of_birth: null,
      }),
      basePending({
        dateOfBirth: "1990-05-10",
        date_of_birth: "1991-05-10",
      }),
    ),
    null,
  );
});
