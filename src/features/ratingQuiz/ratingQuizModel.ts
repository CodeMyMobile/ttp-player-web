/**
 * The NTRP rating quiz: questions, weights and scoring, shared by every copy of it.
 *
 * Used by the public site's quiz (apps/public-site/src/pages/what-is-my-tennis-level.astro),
 * the app's /rating-quiz (pages/RatingQuizPage.tsx) and the group lesson level check
 * (components/group-lessons/LevelCheckDrawer.tsx). The site and the app used to carry
 * their own copies; the app's kept the old weights while both stamped version 2, so the
 * same answers scored half a level or a level higher in the app.
 *
 * No imports, on purpose: the public site is a separate Astro build that imports this
 * file by path, and it must not pull in anything from the app.
 */

/**
 * 3 is the first version shared by both quizzes. Version 2 meant two different models:
 * the public site's recalibrated one, and the app's older one with the comparison
 * question, serve at 1.2 and a 0.34 scale. App-taken v2 seeds were scored on the
 * latter and can be re-scored from their stored rating_quiz_answers.
 */
export const RATING_MODEL_VERSION = 3;

export type RatingQuizAnswerKey = "pool" | "bg" | "usta" | "freq" | "serve" | "rally";

export interface RatingQuizOption {
  id: string;
  label: string;
  detail?: string;
}

export interface RatingQuizQuestion {
  key: RatingQuizAnswerKey;
  prompt: string;
  hint: string;
  branch?: boolean;
  options: RatingQuizOption[];
}

/**
 * The answers as given, plus `feedback`: the player's reply to "does that sound about
 * right?". Feedback is saved with the answers as the calibration signal and is never
 * read by the scorer.
 */
export type RatingQuizAnswers = Partial<Record<RatingQuizAnswerKey | "feedback", string>>;

export type RatingQuizConfidence = "Starting out" | "Estimated" | "Self-declared";

export interface RatingQuizResult {
  seed: number;
  band: string;
  confidence: RatingQuizConfidence;
  why: string;
  declaredUsta: number | null;
  beginner?: boolean;
}

export const ratingQuizQuestions: RatingQuizQuestion[] = [
  {
    key: "pool",
    prompt: "Which do you play?",
    hint: "NTRP is calibrated separately for men's and women's play, so this genuinely changes the answer.",
    options: [
      { id: "m", label: "Men's" },
      { id: "w", label: "Women's" },
    ],
  },
  {
    key: "bg",
    prompt: "How much competitive tennis have you played?",
    hint: "The single biggest clue to your level.",
    options: [
      { id: "starting", label: "I'm just starting out", detail: "New to tennis, or played a handful of times" },
      { id: "social", label: "Not really: social and rec", detail: "Hitting with friends, drop-in play" },
      { id: "lessons", label: "Lessons or clinics regularly", detail: "Group lessons, cardio tennis" },
      { id: "team", label: "High school or club team", detail: "Organized team matches" },
      { id: "usta", label: "USTA league or tournaments", detail: "You already have a rating" },
      { id: "college", label: "College varsity or higher", detail: "NCAA, ITF, satellite or pro" },
    ],
  },
  {
    key: "usta",
    prompt: "What NTRP rating do you play at?",
    hint: "We'll take your word for it. It beats anything we'd estimate.",
    branch: true,
    options: [
      { id: "u30", label: "3.0" },
      { id: "u35", label: "3.5" },
      { id: "u40", label: "4.0" },
      { id: "u45", label: "4.5" },
      { id: "u50", label: "5.0 and above" },
    ],
  },
  {
    key: "freq",
    prompt: "How often are you playing right now?",
    hint: "Current form counts for more than peak form.",
    options: [
      { id: "f3", label: "Three or more times a week" },
      { id: "f2", label: "Once or twice a week" },
      { id: "f1", label: "A few times a month" },
      { id: "f0", label: "Coming back after time off", detail: "We'll factor in the rust" },
    ],
  },
  {
    key: "serve",
    prompt: "Your second serve",
    hint: "This is where levels separate most clearly.",
    options: [
      { id: "s0", label: "Getting it in is the goal", detail: "Double faults happen" },
      { id: "s1", label: "Safe and reliable, not much spin", detail: "Rarely double fault, easy to attack" },
      { id: "s2", label: "A spin serve I trust at 30-40", detail: "It holds up under pressure" },
      { id: "s3", label: "A weapon I can place", detail: "I win free points on serve" },
    ],
  },
  {
    key: "rally",
    prompt: "In a baseline rally",
    hint: "Think about your normal weekly opponents.",
    options: [
      { id: "r0", label: "I focus on getting it back" },
      { id: "r1", label: "I can keep a crosscourt rally going" },
      { id: "r2", label: "I direct the ball on purpose", detail: "Change direction, find the open court" },
      { id: "r3", label: "I construct points and handle real pace" },
    ],
  },
];

/**
 * Every scored answer needs an entry here. A missing one is not an error —
 * `weights[id]` is undefined and `|| 0` turns it into a zero — so the question keeps
 * being asked, keeps being shown as a reason for the result, and counts for nothing.
 * That is what happened to the rally answers on the public site from the day it
 * shipped until 2026-09-14, and only came up because someone read the table. A test
 * runs every answer combination and fails if any answer is missing from it.
 */
export const weights: Record<string, number> = {
  social: 0, lessons: 1, team: 2, college: 4,
  f3: 2, f2: 1, f1: 0, f0: -1,
  s0: 0, s1: 1, s2: 2, s3: 3,
  r0: 0, r1: 1, r2: 2, r3: 3,
};

/**
 * The comparison question ("someone you play often whose level you know") is gone,
 * and nothing was renormalised to compensate.
 *
 * It was circular — it asked for someone "whose level you know" and then never asked
 * what that level was, so beating a 3.0 and beating a 4.5 both scored the same. It
 * could not inform the estimate at any weight. Its neutral answers carried a weight
 * of 0, so removing it moves only players who answered "I usually beat them" or "they
 * usually beat me" — the circular signal itself going away.
 *
 * Serve and rally are the two stroke questions and carry the same weight. They did not
 * before: with rally inert, serve at 1.2 was the entire stroke signal, so a single
 * answer about a second serve moved the estimate as much as both strokes should
 * together.
 *
 * Background stays the heaviest single question — it spans 0 to 4, so 4.4 of range
 * against 2.7 for either stroke — which is what the card claims when it calls it the
 * biggest clue. Frequency stays the modifier it reads as.
 */
export const coefficients: Record<"bg" | "freq" | "serve" | "rally", number> = {
  bg: 1.1,
  freq: 0.5,
  serve: 0.9,
  rally: 0.9,
};

/**
 * Turning rally on widened the raw range from 9.0 to 10.8, so leaving the multiplier
 * at 0.34 would have pushed everyone up half a level or more for no better reason than
 * an arithmetic side effect. 0.23 puts the strongest honest set of answers — college
 * player, playing three times a week, weapon serve, constructs points — at 4.98, which
 * is the 5.0 the top of this scale means. The base stays 2.5, the floor of what this
 * quiz will estimate.
 */
export const SCALE = 0.23;
export const BASE = 2.5;

export const clamps: Record<string, { floor?: number; ceiling?: number }> = {
  social: { ceiling: 3.5 },
  lessons: { ceiling: 4.0 },
  team: { floor: 3.0, ceiling: 4.5 },
  college: { floor: 4.0, ceiling: 5.0 },
};

export const declared: Record<string, number> = { u30: 3.0, u35: 3.5, u40: 4.0, u45: 4.5, u50: 5.0 };

/**
 * NTRP scales are calibrated against different populations. The stroke descriptions in
 * this quiz are absolute, so identical answers place differently on the two scales.
 *
 * UNVALIDATED — currently 0 while we gather data. The question is asked and `pool` is
 * captured on every completion, so nobody is mis-rated by a number we have not checked.
 * When the league data says otherwise, this line is the only edit: the term is applied
 * once, at the end of scoring, and nowhere else.
 */
export const POOL_SHIFT: Record<string, number> = { m: 0, w: 0 };

/** The lowest and highest levels the API accepts as a quiz seed. */
export const MIN_SEED = 1.5;
export const MAX_SEED = 5.0;

const toHalf = (value: number) => Math.round(value * 2) / 2;

export const bandLabel = (seed: number) =>
  seed >= 5 ? "5.0+" : `${seed.toFixed(1)}-${(seed + 0.5).toFixed(1)}`;

/**
 * The one-line reason under the estimate. Four cases rather than two, because the two
 * stroke answers can disagree and the sentence has to survive that: a player with a
 * weapon serve and no rally shape is a different reading from one who constructs
 * points off a serve they only get in.
 */
export const explain = (answers: RatingQuizAnswers): string => {
  const serve = answers.serve === "s2" || answers.serve === "s3";
  const rally = answers.rally === "r2" || answers.rally === "r3";
  if (serve && rally) {
    return "A second serve you trust and a rally you can direct are the two clearest markers at this level, and you have both.";
  }
  if (serve) {
    return "A second serve you trust under pressure is the clearest marker at this level; steadier rally shape is what would move you up half a level.";
  }
  if (rally) {
    return "Directing the ball in a rally puts you here; a second serve you trust under pressure is what would move you up half a level.";
  }
  return "Rally consistency and a reliable second serve are what move players up from here, and they tend to arrive in that order.";
};

/** The questions this player is asked: the USTA question only once they say they have one. */
export const activeRatingQuizQuestions = (answers: RatingQuizAnswers) =>
  ratingQuizQuestions.filter((question) => !question.branch || answers.bg === "usta");

/**
 * Where a question sits in this player's active list, or -1. Looked up, never written
 * down: the skip to the USTA question used to be a literal 1, correct only while the
 * background question was first, and the pool question in front of it pointed the
 * skip at the question it exists to skip.
 */
export const activeQuestionIndex = (answers: RatingQuizAnswers, key: RatingQuizAnswerKey) =>
  activeRatingQuizQuestions(answers).findIndex((question) => question.key === key);

export const scoreRatingQuiz = (answers: RatingQuizAnswers): RatingQuizResult => {
  if (answers.bg === "starting") {
    return {
      seed: 2.0,
      band: "1.5-2.0",
      confidence: "Starting out",
      beginner: true,
      why: "That's a real level with a number, not a blank. What moves you up fastest is court time with someone showing you the basics.",
      declaredUsta: null,
    };
  }

  if (answers.bg === "usta") {
    const seed = declared[answers.usta || ""] || 3.0;
    return {
      seed,
      band: seed >= 5 ? "5.0+" : seed.toFixed(1),
      confidence: "Self-declared",
      // No question count: on this path the player answered two or three, not five.
      why: "You told us your USTA rating, which beats anything we could estimate.",
      declaredUsta: seed,
    };
  }

  let raw = 0;
  (Object.keys(coefficients) as Array<keyof typeof coefficients>).forEach((key) => {
    raw += (weights[answers[key] || ""] || 0) * coefficients[key];
  });

  // Applied to the estimated path only. A declared USTA rating is already on the right
  // scale, and the beginner answer is a floor rather than an estimate.
  let seed = Math.max(2.5, Math.min(5.0, BASE + toHalf(raw * SCALE) + (POOL_SHIFT[answers.pool || ""] || 0)));
  const clamp = clamps[answers.bg || ""] || {};
  if (clamp.ceiling !== undefined && seed > clamp.ceiling) seed = clamp.ceiling;
  if (clamp.floor !== undefined && seed < clamp.floor) seed = clamp.floor;

  return {
    seed,
    band: bandLabel(seed),
    confidence: "Estimated",
    why: explain(answers),
    declaredUsta: null,
  };
};

/**
 * The estimate as the player leaves it: ours until they take the offered half step,
 * theirs afterwards (`declared`), at which point it is labelled as their claim.
 */
export interface SettledLevel {
  seed: number;
  band: string;
  confidence: RatingQuizConfidence;
  declared: boolean;
}

export const settleEstimate = (result: RatingQuizResult): SettledLevel => ({
  seed: result.seed,
  band: result.band,
  confidence: result.confidence,
  declared: false,
});

export const takeNudge = (seed: number): SettledLevel => ({
  seed,
  band: bandLabel(seed),
  confidence: "Self-declared",
  declared: true,
});

/**
 * The half step offered after "lower/higher than I expected", or null when there is no
 * step to offer.
 *
 * Kept within what the API saves (1.5 to 5.0). It used to offer 5.5 from a 5.0
 * estimate; the API rejects a 5.5 seed, so taking it meant nothing was saved at all.
 */
export const nudgeTarget = (seed: number, feedback: string | undefined): number | null => {
  const target =
    feedback === "low" ? Math.min(MAX_SEED, seed + 0.5)
      : feedback === "high" ? Math.max(MIN_SEED, seed - 0.5)
        : null;
  return target === null || target === seed ? null : target;
};

export type RatingQuizPayload =
  | {
      self_rated_seed: number;
      /** "player" once they took the half step: the API's word for a player's own claim. */
      self_rating_source: "self_assessed" | "player";
      rating_quiz_answers: RatingQuizAnswers;
      rating_model_version: typeof RATING_MODEL_VERSION;
    }
  | {
      usta_rating: number;
    };

/**
 * The body PATCH /player/personal_details takes. `settled` is the level as the player
 * left it; without one, the quiz's own estimate.
 */
export const buildRatingQuizPayload = (
  answers: RatingQuizAnswers,
  settled?: SettledLevel | null,
): RatingQuizPayload => {
  const result = scoreRatingQuiz(answers);
  if (result.declaredUsta !== null) {
    return { usta_rating: result.declaredUsta };
  }

  const level = settled ?? settleEstimate(result);
  return {
    self_rated_seed: level.seed,
    self_rating_source: level.declared ? "player" : "self_assessed",
    rating_quiz_answers: answers,
    rating_model_version: RATING_MODEL_VERSION,
  };
};
