import { normalizeLevel, type GroupLessonLevel } from "../api/groupLessons";

/**
 * The minimum level a class asks for, or null when it does not ask for one.
 *
 * THIS IS A LABEL, NOT A REQUIREMENT, AND THE DIFFERENCE MATTERS.
 *
 * There is no `min_level` field on a group lesson. `skill_level`, `level` and
 * `min_level` all come back null on every lesson in production; the only level
 * anywhere is `metadata.level`, a free-text string a coach typed:
 *
 *     "Advanced Plus (NTRP 4.5)"   -> 4.5
 *     "Intermediate (NTRP 3.5)"    -> 3.5
 *     ""                           -> nothing
 *     metadata.levels: []          -> nothing
 *
 * So this reads a number out of prose. It cannot tell "4.5+" from "4.5 only"
 * from "3.5-4.0", and it finds nothing at all for classes whose level lives in
 * the title instead ("Liveball Intensive (2h, curated 3.5-4.0 group)"). Those
 * classes correctly show no notice rather than a guessed one.
 *
 * When the backend grows a real numeric `min_level`, this function is the single
 * place to change — see docs/group-lesson-level-requirement-brief.md.
 */
export const levelRequirementOf = (lesson: {
  level?: GroupLessonLevel | null;
  skillLabel?: string | null;
}): GroupLessonLevel | null => {
  if (lesson.level !== undefined && lesson.level !== null) return lesson.level;
  return normalizeLevel(lesson.skillLabel ?? undefined);
};

/** "USTA 4.5+ required" — the notice title. */
export const levelRequirementTitle = (level: GroupLessonLevel) =>
  `USTA ${level.toFixed(1)}+ required`;

/**
 * Whether a self-assessed level clears the class.
 *
 * Deliberately not a tolerance: the notice says "4.5+", so 4.0 does not clear it.
 * The coach has the final say either way, which is what the copy tells the player
 * — this only decides which of the two result screens they see.
 */
export const meetsLevelRequirement = (
  playerLevel: number | null | undefined,
  requirement: GroupLessonLevel | null,
): boolean => {
  if (requirement === null) return true;
  if (playerLevel === null || playerLevel === undefined || !Number.isFinite(playerLevel)) return false;
  return playerLevel >= requirement;
};
