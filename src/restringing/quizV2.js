// "Help me choose" (VITE_RESTRING_V2): four questions, level first, and a recommendation of
// one in-stock string with its reasons plus one alternative. The catalog says what category a
// string is, not how it plays, so the reasons are about the category, and the string is the
// shop's first in stock in that category ("Our pick").
import { categoryLabel, serviceCompositionLabel } from "./playerFlow.js";

export const QUIZ_QUESTIONS = [
  {
    key: "level",
    label: "What’s your level?",
    options: [
      { value: "getting_started", label: "Getting started", hint: "NTRP 2.5–3.0" },
      { value: "intermediate", label: "Intermediate", hint: "NTRP 3.5–4.0" },
      { value: "advanced", label: "Advanced", hint: "NTRP 4.5+" },
      { value: "competitive", label: "Competitive", hint: "Tournaments, college, open" },
    ],
  },
  {
    key: "arm",
    label: "Any arm, elbow or shoulder discomfort?",
    options: [
      { value: "no", label: "No" },
      { value: "sometimes", label: "Sometimes" },
      { value: "yes", label: "Yes, right now" },
    ],
  },
  {
    key: "priority",
    label: "What matters most?",
    options: [
      { value: "spin", label: "Spin" },
      { value: "control", label: "Control" },
      { value: "power", label: "Power" },
      { value: "comfort", label: "Comfort" },
    ],
  },
  {
    key: "frequency",
    label: "How often do you play?",
    options: [
      { value: "weekly", label: "Once a week or less" },
      { value: "few", label: "2–3 times a week" },
      { value: "most_days", label: "4 or more times a week" },
    ],
  },
];

/**
 * The level option to pre-select from the player's NTRP, or null without one. Competitive is
 * never assumed: a rating doesn't say whether someone plays tournaments.
 */
export function levelFromNtrp(ntrp) {
  const value = Number(ntrp);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value < 3.25) return "getting_started";
  if (value < 4.5) return "intermediate";
  return "advanced";
}

const strongLevel = (level) => level === "advanced" || level === "competitive";

/**
 * Categories to try, best first. The first one with something in stock is the pick; the next
 * different one is the alternative.
 */
export function rankCategories({ level, arm, priority, frequency } = {}) {
  const spinOrControl = priority === "spin" || priority === "control";
  if (arm === "yes") {
    // Never polyester with a sore arm now.
    return strongLevel(level) ? ["prem_multi", "std_multi", "natural_gut", "syn_gut"] : ["std_multi", "prem_multi", "syn_gut"];
  }
  if (arm === "sometimes") {
    if (spinOrControl && strongLevel(level)) return ["poly_multi_hybrid", "prem_multi", "std_multi"];
    return strongLevel(level) ? ["prem_multi", "std_multi", "poly_multi_hybrid"] : ["std_multi", "prem_multi", "syn_gut"];
  }
  if (level === "getting_started") {
    return priority === "comfort" || priority === "power" ? ["std_multi", "syn_gut"] : ["syn_gut", "std_multi"];
  }
  if (spinOrControl || frequency === "most_days") {
    return strongLevel(level) || frequency === "most_days"
      ? ["prem_poly", "std_poly", "poly_multi_hybrid"]
      : ["std_poly", "prem_poly", "syn_gut"];
  }
  return strongLevel(level) ? ["prem_multi", "std_multi", "prem_poly"] : ["std_multi", "prem_multi", "syn_gut"];
}

/** Why, in a sentence or two; about the category and the answers, never invented specs. */
export function reasonsFor(category, { level, arm, priority, frequency } = {}) {
  const reasons = [];
  const poly = category === "std_poly" || category === "prem_poly";
  const multi = category === "std_multi" || category === "prem_multi";
  if (arm === "yes" || arm === "sometimes") {
    reasons.push(category === "poly_multi_hybrid"
      ? "Multifilament crosses soften the bed while polyester mains keep your control."
      : "Gentler on your arm than a full polyester bed.");
  }
  if (poly && (priority === "spin" || priority === "control")) {
    reasons.push(priority === "spin" ? "Polyester grips the ball for the most spin." : "Polyester gives the most control on full swings.");
  }
  if (multi && (priority === "power" || priority === "comfort")) {
    reasons.push(priority === "power" ? "Multifilament gives easy depth and power." : "Multifilament is the softest feel after natural gut.");
  }
  if (category === "syn_gut") reasons.push("A dependable all-round string at the best price.");
  if (poly && frequency === "most_days") reasons.push("Polyester lasts longest when you play most days.");
  if (category.startsWith("prem_") && strongLevel(level)) reasons.push("A premium string for your level.");
  if (level === "getting_started" && !poly) reasons.push("Forgiving while you build your strokes.");
  if (!reasons.length) reasons.push(`${categoryLabel(category)} suits how you play.`);
  return reasons.slice(0, 3);
}

/** Starting tension: lower for polyester, and 2 lbs lower again with any arm discomfort. */
export function tensionFor(category, { arm } = {}) {
  const base = category === "std_poly" || category === "prem_poly" || category === "poly_multi_hybrid" ? 50 : 54;
  return arm === "yes" || arm === "sometimes" ? base - 2 : base;
}

// The quiz names the hybrid and natural gut services by composition; in production they're
// string categories with stocked strings (ttp-api admin_restringing.js). Either matches.
const CATEGORY_ALIASES = {
  poly_multi_hybrid: "poly_multi",
  natural_gut_hybrid: "gut_poly",
  natural_gut: "nat_gut",
};

const labelFor = (category) =>
  ["poly_multi_hybrid", "natural_gut_hybrid", "natural_gut"].includes(category)
    ? serviceCompositionLabel(category)
    : categoryLabel(category);

/**
 * One option for a category at this shop: its tier, and its first in-stock string (preset
 * services have none; the shop picks). Null when the shop can't do that category.
 */
function optionFor(category, tiers, catalog) {
  const codes = [category, CATEGORY_ALIASES[category]].filter(Boolean);
  const tier = (Array.isArray(tiers) ? tiers : []).find((row) =>
    codes.includes(row.string_category) || row.string_composition === category,
  );
  if (!tier) return null;
  if (tier.string_composition) {
    return { category, label: labelFor(category), tierId: tier.id, priceCents: Number(tier.price_cents) || 0, kind: "preset", string: null };
  }
  const string = (Array.isArray(catalog) ? catalog : [])
    .filter((row) => row && row.category === tier.string_category && row.in_stock !== false)
    .sort((left, right) => `${left.brand} ${left.name}`.localeCompare(`${right.brand} ${right.name}`))[0];
  if (!string) return null;
  return { category, label: labelFor(category), tierId: tier.id, priceCents: Number(tier.price_cents) || 0, kind: "string", string };
}

/**
 * The result: { pick, alternative, reasons, tensionLbs, warning }. `pick` is the first ranked
 * category the shop can do; `alternative` the next one. Null when it can do none of them.
 */
export function recommendFromQuiz(answers, { tiers, catalog }) {
  const options = rankCategories(answers)
    .map((category) => optionFor(category, tiers, catalog))
    .filter(Boolean);
  if (!options.length) return null;
  const [pick, alternative = null] = options;
  return {
    pick,
    alternative,
    reasons: reasonsFor(pick.category, answers),
    tensionLbs: tensionFor(pick.category, answers),
    warning: answers?.arm === "yes" ? "Avoid full polyester while your arm is sore." : null,
  };
}
