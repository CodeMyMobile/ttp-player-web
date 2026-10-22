/**
 * Where the rating quiz sends a player after they save, if anywhere.
 *
 * The home page's "Set my rating" opens /rating-quiz?from=home. Saving there goes
 * straight back to home, where the "Players to hit with" block reads the level the
 * save just filled in (the API copies the quiz level into the survey level). Every
 * other way into the quiz keeps the result screen and its next steps.
 */
export const quizReturnPath = (search: string): string | null =>
  new URLSearchParams(search).get("from") === "home" ? "/" : null;
