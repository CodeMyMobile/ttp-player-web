/**
 * Where the rating quiz sends a player after they save, if anywhere.
 *
 * The home page's "Set my rating" opens /rating-quiz?from=home. Saving there goes
 * straight back to home, where the "Players to hit with" block reads the level the
 * save just filled in (the API copies the quiz level into the survey level). The
 * match page's level prompt opens /rating-quiz?from=match-<id> and goes back to
 * that match. Every other way into the quiz keeps the result screen and its next
 * steps.
 */
export const quizReturnPath = (search: string): string | null => {
  const from = new URLSearchParams(search).get("from") || "";
  if (from === "home") return "/";
  // Digits only, so the parameter can never name somewhere outside the app.
  const match = /^match-(\d+)$/.exec(from);
  return match ? `/matches/${match[1]}` : null;
};

/** The quiz link for a match page, which comes back to that match after saving. */
export const quizHrefFromMatch = (matchId: string | number) =>
  /^\d+$/.test(String(matchId))
    ? `/rating-quiz?from=match-${matchId}`
    : "/rating-quiz";
