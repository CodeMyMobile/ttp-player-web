import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCoaches } from "../src/utils/coachFormatting.js";

const apiPayload = {
  data: {
    data: [
      {
        id: 41,
        first_name: "Morgan",
        last_name: "Lee",
        summary: "USPTR certified coach with focus on match strategy and athletic conditioning.",
        availability_summary: [
          { day: "Monday", start: "06:00", end: "09:00" },
          { day: "Wednesday", start: "06:00", end: "09:00" },
          { day: "Saturday", start: "10:00", end: "14:00" },
        ],
        lesson_rate: { amount: 95, currency: "USD", unit: "hr" },
        coach_locations: [
          { name: "Bay Club Redwood Shores", city: "Redwood City", state: "CA", zip: "94065" },
          { name: "Stanford Tennis Center", city: "Stanford", state: "CA", postal_code: "94305" },
        ],
        profile_image: "https://example.com/morgan.jpg",
      },
    ],
  },
};

test("normalizeCoaches integrates API payload into UI-ready model", () => {
  const coaches = normalizeCoaches(apiPayload.data);
  assert.equal(coaches.length, 1);
  const coach = coaches[0];
  assert.equal(coach.name, "Morgan Lee");
  assert.match(coach.availability, /Mon/);
  assert.match(coach.rate.display, /\$/);
  assert.equal(coach.locations.hiddenCount, 0);
  assert.equal(coach.locations.all[0].includes("Bay Club"), true);
});
