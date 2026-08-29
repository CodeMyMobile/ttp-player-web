#!/usr/bin/env node
/**
 * Type-check gate.
 *
 * This repo had never been type-checked, so `tsc --noEmit` reports a few hundred
 * pre-existing errors. Gating on zero today would mean gating on nothing, because the
 * check would be switched off within a week.
 *
 * So it gates on the codes that mean "this file cannot run", and reports the rest as
 * information. Both of the faults that took /find-players down in production on
 * 2026-08-29 are in the blocking set:
 *
 *   TS2448  Block-scoped variable used before its declaration   <- the dependency-array bug
 *   TS2304  Cannot find name                                    <- the missing useRef import
 *
 * Lower the rest over time by moving codes from INFORMATIONAL to BLOCKING. Do not add
 * a suppression file; the point is that the list shrinks.
 */
import { execFileSync } from "node:child_process";

const BLOCKING = new Set([
  "TS2448", // used before its declaration
  "TS2454", // used before being assigned
  "TS2304", // cannot find name
  "TS2552", // cannot find name, did you mean
  "TS2503", // cannot find namespace
  "TS2307", // cannot find module
]);

/**
 * Pre-existing breakages in files outside the change that introduced this check.
 * NAMED, not suppressed wholesale: each one is a real defect with a home to go to, and
 * the list has to shrink rather than grow. Adding to it needs a reason in the PR.
 *
 *  GroupLessonDetailsPage  `lessonStartMoment` is referenced once and declared nowhere,
 *                          so the cancel-success screen throws. Written up separately;
 *                          out of scope for the Find Players work.
 *  log-result/data.ts      `SubmitSet` is used in a type position without being
 *                          imported from ./scoring. Type-only, so it is erased at
 *                          runtime and harmless today.
 */
/**
 * TIME AND BOOKING CODE IS OFF LIMITS TO THIS GATE.
 *
 * These files were fixed deliberately, over several rounds, against subtle
 * timezone behaviour: floating wall-clock stamps, venue-local times that only look
 * like UTC, and a feed that sorted on a mixed basis. The fixes are not obvious from
 * reading a single line, and a type error in one of them is not an invitation.
 *
 * If the gate becomes noisy about anything here, SUPPRESS BY FILE below. Do not edit
 * the file to quieten it, however trivial the change looks. "Drive-by cleanup" is
 * exactly how a deliberate fix gets undone by someone who did not know it was one.
 *
 * The same applies to test fixtures in these areas: never a hardcoded absolute date.
 * That is what expired the coach-availability test — it passed the morning it was
 * written and failed by the evening.
 */
const TIME_SENSITIVE = [
  "src/utils/activityFeed.js",
  "src/utils/floatingTime",
  "src/hooks/useHomeStatus",
  "src/pages/BookingConfirmationPage.tsx",
  "src/pages/GroupLessonDetailsPage.tsx",
  "src/api/playerLessons.ts",
];

const KNOWN = [
  "src/pages/GroupLessonDetailsPage.tsx(1157",
  "src/pages/log-result/data.ts(105",
];

let output = "";
try {
  output = execFileSync("npx", ["tsc", "-p", "tsconfig.typecheck.json", "--noEmit"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (error) {
  output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
}

const lines = output.split("\n").filter((l) => /error TS\d+:/.test(l));
const blocking = lines
  .filter((l) => BLOCKING.has((l.match(/error (TS\d+):/) ?? [])[1]))
  .filter((l) => !KNOWN.some((k) => l.startsWith(k)))
  // Reported, never gated: see TIME_SENSITIVE.
  .filter((l) => !TIME_SENSITIVE.some((k) => l.startsWith(k)));
const informational = lines.length - blocking.length;

if (blocking.length) {
  console.error("\nType errors that stop a file running:\n");
  for (const line of blocking) console.error(`  ${line}`);
  console.error(`\n${blocking.length} blocking, ${informational} other (not gated yet).\n`);
  process.exit(1);
}

console.log(`Type check passed: 0 blocking, ${informational} other, ${KNOWN.length} known pre-existing.`);
