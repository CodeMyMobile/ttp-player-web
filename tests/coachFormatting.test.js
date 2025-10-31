import test from "node:test";
import assert from "node:assert/strict";
import {
  AVAILABILITY_PLACEHOLDER,
  RATE_PLACEHOLDER,
  formatCoachAvailability,
  formatCoachLocations,
  formatCoachRate,
  normalizeCoach,
} from "../src/utils/coachFormatting.js";

const sampleCoach = {
  id: 10,
  first_name: "Jamie",
  last_name: "Rivera",
  bio: "Former Division I player with a passion for junior development.",
  availability: [
    { day: "Monday", start: "07:00", end: "10:00" },
    { day: "Tuesday", start: "07:00", end: "10:00" },
    { day: "Saturday", start: "09:30", end: "12:30" },
  ],
  hourly_rate: { amount: 120, currency: "USD" },
  locations: [
    { name: "Bay Club San Mateo", city: "San Mateo", state: "CA", postalCode: "94403" },
    { name: "South SF Tennis Center", city: "South San Francisco", state: "CA", zip: "94080" },
    "Cupertino Courts — Cupertino, CA 95014",
  ],
};

test("formatCoachAvailability falls back gracefully", () => {
  assert.equal(formatCoachAvailability(null), AVAILABILITY_PLACEHOLDER);
});

test("formatCoachAvailability groups contiguous days", () => {
  const label = formatCoachAvailability(sampleCoach.availability);
  assert.match(label, /Mon–Tue/);
  assert.match(label, /7\s?am/);
  assert.match(label, /Sat/);
});

test("formatCoachLocations removes zip codes and limits visibility", () => {
  const locations = formatCoachLocations(sampleCoach.locations, 2);
  assert.equal(locations.visible.length, 2);
  assert.equal(locations.hiddenCount, 1);
  locations.all.forEach((label) => {
    assert(!/\d{5}/.test(label));
  });
});

test("formatCoachRate renders currency-aware display", () => {
  const rate = formatCoachRate(sampleCoach.hourly_rate);
  assert.equal(rate.display.includes("$"), true);
  assert.equal(rate.display.includes("/"), true);
});

test("normalizeCoach builds cohesive coach model", () => {
  const normalized = normalizeCoach(sampleCoach);
  assert.equal(normalized.name, "Jamie Rivera");
  assert.ok(normalized.headline.length <= 161);
  assert.equal(normalized.availability !== AVAILABILITY_PLACEHOLDER, true);
  assert.equal(normalized.rate.display !== RATE_PLACEHOLDER, true);
  assert.equal(normalized.locations.all.length, 3);
});
