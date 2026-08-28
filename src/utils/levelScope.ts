import type { NormalizedSurveyQuestion } from "./surveyQuestionnaire";

/**
 * Level scoping resolves against the ORDER of the survey's own options, never against
 * numbers parsed out of their labels.
 *
 * The survey is the source of truth for what levels exist and how they rank, so "±0.5"
 * means "the adjacent option either side" rather than "add 0.5 and hope a label matches".
 * That is what lets labels like "NTRP 4.5+" work: arithmetic cannot produce a matching
 * option name for them, ordinal adjacency does not need to.
 *
 * `levelNumber` exists for display only and must not be used for scoping.
 */

const LEVEL_QUESTION_PATTERN = /\bntrp\b|level/i;

// A rankable option carries a digit. "Unknown" / "Prefer not to say" sit in the same
// list but have no position on the ladder, so they are excluded from range maths —
// otherwise the top level's "neighbour" would be Unknown.
const RANKABLE_PATTERN = /\d/;

const normalize = (value: string) => value.trim().toLowerCase();

export const findLevelQuestion = (
  questions: NormalizedSurveyQuestion[] | null | undefined,
): NormalizedSurveyQuestion | null =>
  (questions ?? []).find((question) => LEVEL_QUESTION_PATTERN.test(question.questionText ?? "")) ?? null;

/** Every option label, in the survey's order. */
export const levelOptions = (question: NormalizedSurveyQuestion | null | undefined): string[] =>
  (question?.options ?? [])
    .map((option) => (typeof option.optionText === "string" ? option.optionText.trim() : ""))
    .filter((text) => text.length > 0);

/** The subset that has a position on the ladder. */
export const rankableLevelOptions = (options: string[]): string[] =>
  options.filter((option) => RANKABLE_PATTERN.test(option));

/** Index within `options`, matched case- and whitespace-insensitively. -1 when absent. */
export const levelIndex = (options: string[], level: string | null | undefined): number => {
  if (typeof level !== "string" || level.trim().length === 0) {
    return -1;
  }
  const target = normalize(level);
  return options.findIndex((option) => normalize(option) === target);
};

/**
 * The viewer's level plus `steps` adjacent options either side, clamped at both ends.
 * steps = 1 is ±0.5 on a half-point ladder; steps = 2 is the ±1.0 widening.
 *
 * Returns [] when there is no level, or when the level is not a rankable option —
 * both meaning "cannot scope", which callers should treat as "show everyone".
 */
export const nearLevelRange = (
  options: string[],
  level: string | null | undefined,
  steps = 1,
): string[] => {
  const rankable = rankableLevelOptions(options);
  const index = levelIndex(rankable, level);
  if (index === -1 || steps < 0) {
    return [];
  }
  const from = Math.max(0, index - steps);
  const to = Math.min(rankable.length - 1, index + steps);
  return rankable.slice(from, to + 1);
};

/**
 * Every level that counts as "has answered the level question" — the eligibility
 * predicate for appearing in Find Players at all.
 *
 * Rankable only: a player who answered "Prefer not to say" has completed the question
 * but cannot be given a match verdict or a position, which is the one field the card
 * cannot render without.
 */
export const eligibleLevelOptions = (options: string[]): string[] => rankableLevelOptions(options);

/** Display only — never use this to decide who is in range. */
export const levelNumber = (label: string | null | undefined): number | null => {
  if (typeof label !== "string") {
    return null;
  }
  const match = label.match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
};
