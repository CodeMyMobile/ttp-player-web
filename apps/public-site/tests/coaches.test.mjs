import assert from "node:assert/strict";
import test from "node:test";

import { buildPublicCoaches, getAreaCoaches } from "../src/lib/coaches.ts";

const venues = {
  "Culver City High School": { name: "Culver City High School", area: "culver-city" },
  "Penmar Recreation Center": { name: "Penmar Recreation Center", area: "venice" },
};

test("public coach mapper permits consented fields and drops unknown venues", () => {
  const coaches = buildPublicCoaches([
    {
      is_public: true,
      slug: "dean-kern",
      name: "Dean Kern",
      photo_url: "https://private.example/dean.jpg",
      rate_private: 150,
      rate_group: 50,
      bio: "word ".repeat(60),
      focus_areas: ["doubles"],
      certifications: ["USPTA"],
      student_count: 11,
      courts: [{ name: "Culver City High School" }, { name: "123 Private Drive" }, { name: "Penmar Recreation Center" }],
      phone: "+13105551212",
      email: "dean@example.com",
    },
  ], venues);

  assert.deepEqual(coaches, [{
    slug: "dean-kern",
    name: "Dean Kern",
    photo: "https://private.example/dean.jpg",
    // Null unless the slug has an entry in PHOTO_FOCUS — the card crop override.
    photoFocus: null,
    // Resolved after this mapper, by the join against /public/coaches/search.
    appId: null,
    privateRate: 150,
    groupRate: 50,
    bio: "word ".repeat(60).trim(),
    // Card copy, derived from bio: emoji stripped and clamped. bio stays whole.
    excerpt: `${"word ".repeat(20).trim()}…`,
    // Empty because this fixture sends no formats; /public/coaches does not map them yet.
    formats: [],
    focus: ["doubles"],
    certifications: ["USPTA"],
    students: 11,
    // Absent from /public/coaches today; present on the type so the facts row lights up
    // when the endpoint carries them.
    experienceYears: null,
    languages: [],
    courts: [
      { name: "Culver City High School", area: "culver-city" },
      { name: "Penmar Recreation Center", area: "venice" },
    ],
    areas: ["culver-city", "venice"],
    indexable: true,
  }]);
});

test("short biographies remain usable but not indexable", () => {
  const [coach] = buildPublicCoaches([{
    is_public: true,
    slug: "short-bio",
    name: "Short Bio",
    rate_private: 80,
    bio: "A real but brief coach bio.",
    courts: [{ name: "Culver City High School" }],
  }], venues);

  assert.equal(coach.indexable, false);
});

test("venue lookup normalizes API labels before applying the allowlist", () => {
  const [coach] = buildPublicCoaches([{
    slug: "venue-coach",
    name: "Venue Coach",
    courts: [{ name: "Culver City High School Tennis Court Culver City, CA 90230, USA" }],
  }], venues);

  assert.deepEqual(coach.courts, [{ name: "Culver City High School", area: "culver-city" }]);
});

test("area groups include only three-coach routes", () => {
  const coaches = buildPublicCoaches([
    "one", "two", "three", "four",
  ].map((slug, index) => ({
    is_public: true,
    slug,
    name: slug,
    rate_private: 100,
    courts: [{ name: index === 3 ? "Penmar Recreation Center" : "Culver City High School" }],
  })), venues);

  assert.deepEqual([...getAreaCoaches(coaches).keys()], ["culver-city"]);
});

test("missing stored slug rejects build data", () => {
  assert.throws(
    () => buildPublicCoaches([{ is_public: true, name: "No Slug", courts: [] }], venues),
    /stored slug/i,
  );
});
