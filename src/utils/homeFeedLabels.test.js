import assert from "node:assert/strict";
import test from "node:test";

import {
  feedCtaLabel,
  feedDayLabel,
  feedInitials,
  feedMetaLabel,
  feedPriceLabel,
  feedTimeLabel,
  feedTypeLabel,
} from "./homeFeedLabels";

// Local noon, so ±hours stay inside the same local day wherever this runs.
const NOW = new Date(2026, 7, 4, 12, 0, 0);

test("type labels are sentence case, matching the mockups", () => {
  assert.equal(feedTypeLabel("private"), "Private lesson");
  assert.equal(feedTypeLabel("group"), "Group lesson");
  assert.equal(feedTypeLabel("match"), "Match play");
  // Not folded into "Group lesson": it is booked somewhere else and saying so
  // is the honest label, even though the chips count it under Groups.
  assert.equal(feedTypeLabel("external"), "External lesson");
});

test("an unknown type still renders something rather than blank", () => {
  assert.equal(feedTypeLabel("clinic"), "Session");
  assert.equal(feedTypeLabel(undefined), "Session");
});

test("matches are joined, everything else booked", () => {
  assert.equal(feedCtaLabel("match"), "Join");
  assert.equal(feedCtaLabel("private"), "Book");
  assert.equal(feedCtaLabel("group"), "Book");
});

test("day labels read Today, Tomorrow, then a weekday", () => {
  assert.equal(feedDayLabel("2026-08-04", NOW), "Today");
  assert.equal(feedDayLabel("2026-08-05", NOW), "Tomorrow");
  assert.match(feedDayLabel("2026-08-08", NOW), /Sat/);
});

test("Today survives a late-evening now, because days are compared as calendar days", () => {
  const lateEvening = new Date(2026, 7, 4, 23, 30, 0);
  assert.equal(feedDayLabel("2026-08-04", lateEvening), "Today");
  assert.equal(feedDayLabel("2026-08-05", lateEvening), "Tomorrow");
});

test("a missing or unparseable day yields null, not a broken label", () => {
  assert.equal(feedDayLabel(null, NOW), null);
  assert.equal(feedDayLabel("", NOW), null);
  assert.equal(feedDayLabel("not-a-date", NOW), null);
});

test("the time line joins day and clock, or renders whichever half exists", () => {
  assert.equal(feedTimeLabel({ dayKey: "2026-08-04", time: "12:00 PM" }, NOW), "Today · 12:00 PM");
  assert.equal(feedTimeLabel({ dayKey: "2026-08-05", time: "7:00 PM" }, NOW), "Tomorrow · 7:00 PM");
  assert.equal(feedTimeLabel({ dayKey: "2026-08-04" }, NOW), "Today");
  assert.equal(feedTimeLabel({ time: "7:00 PM" }, NOW), "7:00 PM");
  assert.equal(feedTimeLabel({}, NOW), null);
  assert.equal(feedTimeLabel(null, NOW), null);
});

test("the meta line never renders a dangling separator", () => {
  assert.equal(
    feedMetaLabel({ location: "1880 Loma Vista Dr", secondaryMeta: "7.7 mi" }),
    "1880 Loma Vista Dr · 7.7 mi",
  );
  assert.equal(feedMetaLabel({ location: "Penmar" }), "Penmar");
  assert.equal(feedMetaLabel({ secondaryMeta: "1.2 mi" }), "1.2 mi");
  assert.equal(feedMetaLabel({ location: "   ", secondaryMeta: null }), null);
  assert.equal(feedMetaLabel(null), null);
});

test("an unknown price is omitted, never shown as Free", () => {
  // The zero-versus-null rule: only a real zero is free.
  assert.equal(feedPriceLabel(0), "Free");
  assert.equal(feedPriceLabel(25), "$25");
  assert.equal(feedPriceLabel(100), "$100");
  assert.equal(feedPriceLabel(12.5), "$12.50");
  assert.equal(feedPriceLabel(null), null);
  assert.equal(feedPriceLabel(undefined), null);
  assert.equal(feedPriceLabel("25"), null);
  assert.equal(feedPriceLabel(NaN), null);
});

test("emoji badges are not treated as initials", () => {
  // The builders put a coach's initials here for private lessons but an emoji
  // badge for every other type. Rendering "↗" in an avatar circle is the
  // legacy card's placeholder, not something the mockups draw.
  assert.equal(feedInitials("JC"), "JC");
  assert.equal(feedInitials("j"), "J");
  assert.equal(feedInitials("MDX"), "MDX");
  assert.equal(feedInitials("👥"), null);
  assert.equal(feedInitials("🏆"), null);
  assert.equal(feedInitials("↗"), null);
  assert.equal(feedInitials("🎾"), null);
});

test("anything that is not plainly initials falls through to the type icon", () => {
  assert.equal(feedInitials(""), null);
  assert.equal(feedInitials("   "), null);
  assert.equal(feedInitials(null), null);
  assert.equal(feedInitials(undefined), null);
  assert.equal(feedInitials("Coach John"), null);
  assert.equal(feedInitials(42), null);
});
