export const RATING_MODEL_VERSION = 2;

export type RatingQuizAnswerKey = "bg" | "usta" | "freq" | "serve" | "rally" | "cmp";

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

export type RatingQuizAnswers = Partial<Record<RatingQuizAnswerKey, string>>;

export type RatingQuizPayload =
  | {
      self_rated_seed: number;
      self_rating_source: "self_assessed";
      rating_quiz_answers: RatingQuizAnswers;
      rating_model_version: typeof RATING_MODEL_VERSION;
    }
  | {
      usta_rating: number;
    };

export interface RatingQuizResult {
  seed: number;
  band: string;
  confidence: "Starting out" | "Estimated" | "Self-declared";
  why: string;
  declaredUsta: number | null;
  beginner?: boolean;
}

export const ratingQuizQuestions: RatingQuizQuestion[] = [
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
  {
    key: "cmp",
    prompt: "Think of someone you play often whose level you know",
    hint: "Optional, but it sharpens the estimate more than anything else here.",
    options: [
      { id: "c_win", label: "I usually beat them" },
      { id: "c_split", label: "We split most of the time" },
      { id: "c_lose", label: "They usually beat me" },
      { id: "c_skip", label: "I'd rather skip this" },
    ],
  },
];

const weights: Record<string, number> = {
  social: 0,
  lessons: 1,
  team: 2,
  college: 4,
  f3: 2,
  f2: 1,
  f1: 0,
  f0: -1,
  s0: 0,
  s1: 1,
  s2: 2,
  s3: 3,
  r0: 0,
  r1: 1,
  r2: 2,
  r3: 3,
  c_win: 1,
  c_split: 0,
  c_lose: -1,
  c_skip: 0,
};

const coefficients: Record<string, number> = { bg: 1.1, freq: 0.5, serve: 1.2, rally: 1.1, cmp: 0.4 };
const clamps: Record<string, { floor?: number; ceiling?: number }> = {
  social: { ceiling: 3.5 },
  lessons: { ceiling: 4.0 },
  team: { floor: 3.0, ceiling: 4.5 },
  college: { floor: 4.0, ceiling: 5.0 },
};
const declared: Record<string, number> = { u30: 3.0, u35: 3.5, u40: 4.0, u45: 4.5, u50: 5.0 };

const toHalf = (value: number) => Math.round(value * 2) / 2;

export const bandLabel = (seed: number) =>
  seed >= 5 ? "5.0+" : `${seed.toFixed(1)}-${(seed + 0.5).toFixed(1)}`;

export const activeRatingQuizQuestions = (answers: RatingQuizAnswers) =>
  ratingQuizQuestions.filter((question) => !question.branch || answers.bg === "usta");

export const scoreRatingQuiz = (answers: RatingQuizAnswers): RatingQuizResult => {
  if (answers.bg === "starting") {
    return {
      seed: 2.0,
      band: "1.5-2.0",
      confidence: "Starting out",
      beginner: true,
      why: "That's a real level with a number, not a blank. Court time with a coach moves you up faster than match play.",
      declaredUsta: null,
    };
  }

  if (answers.bg === "usta") {
    const seed = declared[answers.usta || ""] || 3.0;
    return {
      seed,
      band: seed >= 5 ? "5.0+" : seed.toFixed(1),
      confidence: "Self-declared",
      why: "You told us your USTA rating, which beats anything we could work out from five questions.",
      declaredUsta: seed,
    };
  }

  let raw = 0;
  Object.keys(coefficients).forEach((key) => {
    const answer = answers[key as RatingQuizAnswerKey];
    if (key === "cmp" && !answer) return;
    raw += (weights[answer || ""] || 0) * coefficients[key];
  });

  let seed = Math.max(2.5, Math.min(5.0, 2.5 + toHalf(raw * 0.34)));
  const clamp = clamps[answers.bg || ""] || {};
  if (clamp.ceiling !== undefined && seed > clamp.ceiling) seed = clamp.ceiling;
  if (clamp.floor !== undefined && seed < clamp.floor) seed = clamp.floor;

  return {
    seed,
    band: bandLabel(seed),
    confidence: "Estimated",
    why:
      answers.serve === "s2" || answers.serve === "s3"
        ? "A second serve you trust under pressure is the clearest marker at this level, and your rally answer backs it up."
        : "Your rally consistency puts you here; the second serve is what would move you up half a level.",
    declaredUsta: null,
  };
};

export const buildRatingQuizPayload = (answers: RatingQuizAnswers): RatingQuizPayload => {
  const result = scoreRatingQuiz(answers);
  if (result.declaredUsta !== null) {
    return { usta_rating: result.declaredUsta };
  }

  return {
    self_rated_seed: result.seed,
    self_rating_source: "self_assessed",
    rating_quiz_answers: answers,
    rating_model_version: RATING_MODEL_VERSION,
  };
};
