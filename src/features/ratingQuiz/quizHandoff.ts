import type { PatchPlayerPersonalDetailsBody } from "../../api/playerProfile";

/**
 * The public site's "what is my tennis level" quiz runs on thetennisplan.com,
 * so it can't save anything to an account. Its result reaches the app as a
 * `quiz` query parameter on /save-level: the same JSON body the quiz shows
 * under "What the app saves if you sign in".
 *
 * The parameter arrives in a URL anyone can edit, so this accepts only what
 * PATCH /player/personal_details itself would accept and drops anything else.
 * A rejected handoff just means nothing is saved; the player still lands home.
 */

export type QuizHandoffPayload = Pick<
  PatchPlayerPersonalDetailsBody,
  "usta_rating" | "self_rated_seed" | "self_rating_source" | "rating_quiz_answers" | "rating_model_version"
>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isHalfStep = (value: number, min: number, max: number) =>
  Number.isFinite(value) && value >= min && value <= max && Number.isInteger(value * 2);

// The public quiz labels a level the player nudged themselves "self_declared".
// The API has no such source; "player" is its word for a player's own claim.
const SOURCE_MAP: Record<string, "self_assessed" | "player"> = {
  self_assessed: "self_assessed",
  self_declared: "player",
};

const MAX_ANSWER_KEYS = 20;
const MAX_ANSWER_LENGTH = 40;

const cleanAnswers = (value: unknown): Record<string, string> | undefined => {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).filter(
    ([key, answer]) => typeof answer === "string" && key.length <= MAX_ANSWER_LENGTH && answer.length <= MAX_ANSWER_LENGTH,
  ) as Array<[string, string]>;
  if (entries.length === 0 || entries.length > MAX_ANSWER_KEYS) return undefined;
  return Object.fromEntries(entries);
};

export const parseQuizHandoff = (search: string | null | undefined): QuizHandoffPayload | null => {
  let raw: string | null;
  try {
    raw = new URLSearchParams(search ?? "").get("quiz");
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  // Someone who told the quiz their USTA rating: the rating is the whole answer.
  if (parsed.usta_rating !== undefined) {
    const usta = Number(parsed.usta_rating);
    return isHalfStep(usta, 1.0, 7.0) ? { usta_rating: usta } : null;
  }

  // The API accepts quiz seeds from 1.5 to 5.0 in half steps, nothing else.
  const seed = Number(parsed.self_rated_seed);
  if (!isHalfStep(seed, 1.5, 5.0)) return null;

  const payload: QuizHandoffPayload = {
    self_rated_seed: seed,
    self_rating_source: SOURCE_MAP[String(parsed.self_rating_source)] ?? "self_assessed",
  };

  const answers = cleanAnswers(parsed.rating_quiz_answers);
  if (answers) payload.rating_quiz_answers = answers;

  const version = Number(parsed.rating_model_version);
  if (Number.isInteger(version) && version > 0) payload.rating_model_version = version;

  return payload;
};
