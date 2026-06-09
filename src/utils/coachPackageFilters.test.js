import assert from "node:assert/strict";
import test from "node:test";

import {
  filterCoachPackagesByLessonType,
  getCoachPackageLessonTypeOptions,
} from "./coachPackageFilters.js";

const packages = [
  { id: "private", lesson_types_allowed: ["private"] },
  { id: "group", lesson_types_allowed: ["group"] },
  { id: "universal", lesson_types_allowed: [] },
];

test("all package filter includes private, group, and universal offers", () => {
  assert.deepEqual(
    filterCoachPackagesByLessonType(packages, "all").map((pkg) => pkg.id),
    ["private", "group", "universal"],
  );
});

test("private package filter includes private and universal offers", () => {
  assert.deepEqual(
    filterCoachPackagesByLessonType(packages, "private").map((pkg) => pkg.id),
    ["private", "universal"],
  );
});

test("group package filter includes group offers only", () => {
  assert.deepEqual(
    filterCoachPackagesByLessonType(packages, "group").map((pkg) => pkg.id),
    ["group"],
  );
});

test("package filter options include all when any package exists", () => {
  assert.deepEqual(
    getCoachPackageLessonTypeOptions({
      packages,
      hasGroupSlots: true,
      privatePriceLabel: "$120",
      groupPriceLabel: "$40",
    }),
    [
      { id: "all", label: "All packages" },
      { id: "private", label: "Private · $120/hr" },
      { id: "group", label: "Group · $40/hr" },
    ],
  );
});
