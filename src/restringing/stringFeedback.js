// How a player's strings felt (ttp-api src/services/stringFeedback.js). About 12 days after
// pickup My orders asks "How's your …?": stars first, then optional details. Ratings are
// used, anonymised, to improve string recommendations; the first one says so.

import { formatShopDate, orderItemLine } from "./myOrders.js";

export const CONSENT_LINE = "Your ratings are used, anonymised, to improve string recommendations.";

export const AGAIN_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "No" },
];

export const FEEL_OPTIONS = [
  { value: "too_stiff", label: "Too stiff" },
  { value: "right", label: "Just right" },
  { value: "too_soft", label: "Too soft" },
];

// Spin, control and comfort: 1 (poor) to 3 (great).
export const TRAIT_KEYS = [
  { key: "spin", label: "Spin" },
  { key: "control", label: "Control" },
  { key: "comfort", label: "Comfort" },
];
export const TRAIT_OPTIONS = [
  { value: 1, label: "Poor" },
  { value: 2, label: "OK" },
  { value: 3, label: "Great" },
];

export const ARM_OPTIONS = [
  { value: false, label: "No" },
  { value: true, label: "Yes" },
];

export const COMMENT_MAX_LENGTH = 500;

// After a rating, one question about their game at a time, only those not yet answered.
export const GAME_QUESTIONS = [
  {
    key: "swing",
    label: "How would you describe your swing?",
    options: [
      { value: "compact", label: "Compact" },
      { value: "medium", label: "Medium" },
      { value: "full", label: "Long and fast" },
    ],
  },
  {
    key: "play_style",
    label: "Where do you like to play?",
    options: [
      { value: "baseline", label: "From the baseline" },
      { value: "all_court", label: "All court" },
      { value: "net", label: "At the net" },
    ],
  },
];

/** The next game question the player hasn't answered, or null. */
export const nextGameQuestion = (profile) =>
  GAME_QUESTIONS.find((question) => !profile?.[question.key]) || null;

/** A My strings row in the shape the order lines read. */
const asItem = (row) => ({
  racket_make_model: row?.racket_make_model,
  string_brand: row?.string?.brand,
  string_name: row?.string?.name,
  crosses_string_brand: row?.crosses_string?.brand,
  crosses_string_name: row?.crosses_string?.name,
  own_string_text: row?.own_string_text,
  custom_string_text: row?.custom_string_text,
  gauge: row?.gauge,
  tension_lbs_mains: row?.tension_lbs_mains,
  tension_lbs_crosses: row?.tension_lbs_crosses,
});

/** "Babolat RPM Blast", or "Babolat RPM Blast / Wilson NXT" for a hybrid. */
export function setupName(row) {
  const name = (string) => [string?.brand, string?.name].filter(Boolean).join(" ").trim();
  const mains = name(row?.string);
  const crosses = name(row?.crosses_string);
  if (mains && crosses && crosses !== mains) return `${mains} / ${crosses}`;
  return mains || (row?.own_string_text ? `Own string: ${row.own_string_text}` : "Stringer’s choice");
}

/** Racket as the title, then string · gauge · tension, and when it was picked up. */
export function setupLine(row) {
  const line = orderItemLine(asItem(row));
  const when = formatShopDate(row?.picked_up_at);
  return { ...line, when: when ? `Picked up ${when}` : "" };
}

/** The rackets to ask about now: rateable and unrated, or rated by text without the details. */
export const ratingCards = (strings) => (Array.isArray(strings) ? strings.filter((row) => row?.to_rate) : []);

/** The details form, starting from what the player has already said. */
export const startingAnswers = (row) => ({
  overall: row?.feedback?.overall || 0,
  again: row?.feedback?.again || null,
  feel: row?.feedback?.feel || null,
  spin: row?.feedback?.spin || null,
  control: row?.feedback?.control || null,
  comfort: row?.feedback?.comfort || null,
  arm_discomfort: row?.feedback?.arm_discomfort ?? null,
  comment: row?.feedback?.comment || "",
});

/** What the API takes: overall and whatever was answered, with consent the first time. */
export function ratingBody(answers, { consented }) {
  const body = { overall: answers.overall };
  for (const key of ["again", "feel", "spin", "control", "comfort"]) {
    if (answers[key] !== null && answers[key] !== undefined) body[key] = answers[key];
  }
  if (typeof answers.arm_discomfort === "boolean") body.arm_discomfort = answers.arm_discomfort;
  const comment = String(answers.comment || "").trim();
  if (comment) body.comment = comment.slice(0, COMMENT_MAX_LENGTH);
  if (!consented) body.consent = true;
  return body;
}

export const starsLabel = (overall) => `${overall} out of 5`;
