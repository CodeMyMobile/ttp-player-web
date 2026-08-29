#!/usr/bin/env node
/**
 * Type-check gate.
 *
 * Both faults that took /find-players down in production on 2026-08-29 were TypeScript
 * errors — TS2448 "block-scoped variable used before its declaration" and TS2304
 * "cannot find name". The build, 479 unit tests and the linter were all green while the
 * page rendered nothing. This is the cheapest check that catches that class, and it
 * covers every file rather than one page.
 *
 * HOW IT GATES
 * The repo had never been type-checked, so there are a few hundred pre-existing errors.
 * Gating on zero would mean gating on nothing, because the check would be switched off
 * within a week. So the existing errors are BASELINED — recorded in
 * typecheck-baseline.json — and the gate fails on anything that is not in that baseline.
 *
 *   - nobody is pushed to clean up errors they did not write
 *   - a NEW error blocks, in every file, including the ones nobody may touch
 *
 * Baselining rather than exempting matters most for the time and booking code. Those
 * files must not be edited for cleanup (see below), but they still need the safety net:
 * a fresh TDZ violation in BookingConfirmationPage is today's outage happening again in
 * the one area we have promised not to break.
 *
 * TIME AND BOOKING CODE — DO NOT CLEAN UP
 *   src/utils/activityFeed.js, src/utils/floatingTime*, src/hooks/useHomeStatus*,
 *   src/pages/BookingConfirmationPage.tsx, src/pages/GroupLessonDetailsPage.tsx,
 *   src/api/playerLessons.ts
 * These were fixed deliberately, over several rounds, against subtle timezone behaviour:
 * floating wall-clock stamps, venue-local times that only look like UTC, a feed sorting
 * on a mixed basis. A pre-existing type error in one of them is not an invitation —
 * "drive-by cleanup" is how a deliberate fix gets undone by someone who did not know it
 * was one. Leave them in the baseline.
 *
 * Test fixtures in those areas must never use a hardcoded absolute date. That is what
 * expired the coach-availability test: green the morning it was written, red by evening.
 *
 * REGENERATING THE BASELINE
 *   npm run typecheck:baseline
 * Only after deliberately fixing errors, and the file should shrink. If a diff makes it
 * grow, that is the review question.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const BASELINE_PATH = new URL("./typecheck-baseline.json", import.meta.url);

/** Codes that mean the file cannot run. Everything else is reported, not gated. */
const BLOCKING = new Set([
  "TS2448", // block-scoped variable used before its declaration
  "TS2454", // variable used before being assigned
  "TS2304", // cannot find name
  "TS2552", // cannot find name, did you mean...
  "TS2503", // cannot find namespace
  "TS2307", // cannot find module
]);

const run = () => {
  try {
    return execFileSync("npx", ["tsc", "-p", "tsconfig.typecheck.json", "--noEmit"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    return `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
};

/**
 * Key without line or column. Moving code must not look like a new error, but a
 * genuinely new one in the same file still appears.
 */
const keyOf = (line) => {
  const m = line.match(/^(.+?)\(\d+,\d+\): error (TS\d+): (.*)$/);
  return m ? `${m[1]}|${m[2]}|${m[3]}` : null;
};

const codeOf = (line) => (line.match(/error (TS\d+):/) ?? [])[1];

const lines = run().split("\n").filter((l) => /error TS\d+:/.test(l));

if (process.argv.includes("--write-baseline")) {
  const keys = [...new Set(lines.map(keyOf).filter(Boolean))].sort();
  writeFileSync(BASELINE_PATH, `${JSON.stringify(keys, null, 2)}\n`);
  console.log(`Baseline written: ${keys.length} known errors.`);
  process.exit(0);
}

const baseline = new Set(
  existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : [],
);

const isNew = (l) => !baseline.has(keyOf(l));
const newBlocking = lines.filter((l) => BLOCKING.has(codeOf(l)) && isNew(l));
const newOther = lines.filter((l) => !BLOCKING.has(codeOf(l)) && isNew(l));

if (newBlocking.length) {
  console.error("\nNew type errors that stop a file running:\n");
  for (const line of newBlocking) console.error(`  ${line}`);
  console.error(
    `\n${newBlocking.length} new blocking. ${baseline.size} pre-existing errors are baselined and ignored.`,
  );
  console.error("If you believe one of these is pre-existing, rebase — do not widen the baseline.\n");
  process.exit(1);
}

const parts = [`0 new blocking`, `${baseline.size} baselined`];
if (newOther.length) parts.push(`${newOther.length} new non-blocking (reported only)`);
console.log(`Type check passed: ${parts.join(", ")}.`);
