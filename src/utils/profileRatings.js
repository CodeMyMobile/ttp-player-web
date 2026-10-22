export const normalizeProfileRating = (value) => {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(value);
};

export const formatCalculatedRating = (value) => (
  value ? value : "Not available"
);

/** "3.5" for 3.5, "3.500000" or "3.50"; "3.75" keeps its quarter. "" when absent. */
export const formatLevelLabel = (value) => {
  const numeric = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(numeric) || numeric <= 0) {
    return "";
  }
  return Number.isInteger(Math.round(numeric * 100) / 10) ? numeric.toFixed(1) : numeric.toFixed(2);
};

/**
 * The level the profile's NTRP field shows once it can no longer be edited, and
 * where it came from. A declared USTA rating wins, then a match-derived rating,
 * then the rating quiz's estimate (self_rated_seed), which this field used to
 * ignore — so a player who had just taken the quiz saw an empty, locked field.
 */
export const resolveProfileLevel = ({
  usta_rating,
  calculated_ntrp,
  self_rated_seed,
  matches_played,
} = {}) => {
  const declared = formatLevelLabel(usta_rating);
  if (declared) return { value: declared, source: "declared" };

  const matchRating = Number(matches_played || 0) > 0 ? formatLevelLabel(calculated_ntrp) : "";
  if (matchRating) return { value: matchRating, source: "match" };

  const quiz = formatLevelLabel(self_rated_seed);
  if (quiz) return { value: quiz, source: "quiz" };

  return { value: "", source: null };
};

/**
 * The dropdown's options with the shown value included. Match ratings move in
 * quarter steps and a stored rating may not be one of the choices; a <select>
 * whose value has no option renders blank, which reads as "not saved".
 */
export const levelOptionsIncluding = (options, value) =>
  !value || options.includes(value)
    ? options
    : [...options, value].sort((a, b) => Number(a) - Number(b));
