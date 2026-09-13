/**
 * What the home rating tile says to a player who is not rated yet.
 *
 * Two stores are in play and they answer different questions. `usta_rating` and
 * `self_rated_seed` live on the player profile and say what level someone
 * believes they are. The ladder's `ranked` flag comes from
 * GET /match-results/rankings/me and is true only for
 * `current_rating IS NOT NULL AND matches_played > 0` — it says whether they
 * have played a rated match. Neither reconciles with the other.
 *
 * So a player can sit on a declared 4.5 and still be unranked, which is correct.
 * What was wrong was telling them to "Find your tennis level" — they have one,
 * and being asked to find it reads as though the app lost their answer. The gate
 * stays; only what it says changes.
 *
 * The `matches_played > 0` half of that gate is deliberate and should not be
 * relaxed to "has a rating": recomputeRatings() writes current_rating for every
 * profile, so in production most rows carry 0 with no matches behind them, and
 * gating on a non-null rating would report a rating of 0.0 to accounts that have
 * never played.
 */
export interface RatingPrompt {
  title: string;
  sub: string;
  href: string;
}

/** "4.5", never "4.50" — matches how a level is written on the profile. */
const formatLevel = (level: number) =>
  Number.isInteger(level * 10) ? level.toFixed(1) : String(level);

/**
 * Reads either profile field, preferring a declared USTA rating over a quiz
 * estimate: the quiz itself defers to it — answering "I have a USTA rating"
 * writes usta_rating and no seed, on the grounds that it beats anything five
 * questions can work out.
 */
export const declaredLevelOf = (profile: {
  usta_rating?: number | string | null;
  self_rated_seed?: number | string | null;
} | null | undefined): number | null => {
  for (const raw of [profile?.usta_rating, profile?.self_rated_seed]) {
    if (raw === null || raw === undefined || raw === "") continue;
    const value = Number(raw);
    // Levels are positive. A 0 here means "written by a bulk recompute, not by a
    // person", which is not a declared level and must not be echoed back as one.
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
};

export const ratingPrompt = (declaredLevel: number | null): RatingPrompt => {
  if (declaredLevel === null) {
    return {
      title: "Find your tennis level",
      sub: "Five questions, then save an estimate",
      href: "/rating-quiz",
    };
  }

  return {
    title: `Confirm your ${formatLevel(declaredLevel)}`,
    sub: "Play a rated match to join the ladder",
    href: "/matches",
  };
};
