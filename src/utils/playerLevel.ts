// Resolving "what level is this player?" — one place, because the app currently
// answers it four different ways and they disagree.
//
// Three independent stores hold a level, on two different numeric scales:
//
//   usta_rating       decimal(3,1)   NTRP  (3.5)   self-declared, player typed it
//   skillLevel /
//     skill_level     free text             the onboarding survey answer
//                                           (questions.id 3, ttp-api player_survey.js:634)
//   calculated_ntrp   number         NTRP  (4.5)   derived per request from
//                                           current_rating + rating_gender
//                                           (ttp-api rating_equivalents.js)
//
// calculated_ntrp is the only one backed by played results, so it wins. It is null
// whenever current_rating is absent or rating_gender is not M/F — the normal state
// for a self-rating player — so the self-reported values remain the fallback and
// most of the roster resolves exactly as it did before.

/** Loosely-typed because these objects come from localStorage and the login payload. */
export interface LevelSourceRecord {
  calculated_ntrp?: number | string | null;
  usta_rating?: number | string | null;
  skillLevel?: number | string | null;
  skill_level?: number | string | null;
  profile?: LevelSourceRecord | null;
  [key: string]: unknown;
}

export interface LevelSources {
  /** The AuthContext user, or a raw parse of localStorage "user". */
  authUser?: LevelSourceRecord | null;
  /** localStorage "playerPersonalDetails". */
  personalDetails?: LevelSourceRecord | null;
  /** localStorage "authLoginResponse". */
  loginResponse?: LevelSourceRecord | null;
}

const present = (value: unknown): value is number | string =>
  value !== null && value !== undefined && value !== "";

/**
 * The computed NTRP, from wherever it happens to be.
 *
 * Every nesting below has been observed on a real session, and the obvious one is
 * the wrong one: ttp-api enriches the profile in ensurePlayerStripeCustomer and
 * assigns it to `resBody.profile` (routes/auth.js:107,157,416), but AuthContext does
 * `setUser(response.user || response.profile)` and `response.user` wins — so the
 * enriched sibling never reaches the user object that most callers hold.
 *
 * personalDetails before loginResponse: GET /player/personal_details also runs through
 * withCalculatedRatingEquivalents (player_profile.js:322) and is refetched, so it
 * reflects a rating change that the login payload would still show stale.
 */
export const resolveComputedNtrp = ({
  authUser,
  personalDetails,
  loginResponse,
}: LevelSources): number | string | null => {
  const candidates = [
    authUser?.calculated_ntrp,
    authUser?.profile?.calculated_ntrp,
    personalDetails?.calculated_ntrp,
    personalDetails?.profile?.calculated_ntrp,
    loginResponse?.profile?.calculated_ntrp,
    loginResponse?.calculated_ntrp,
  ];
  return candidates.find(present) ?? null;
};

/** The self-reported level: the survey answer, then the typed-in USTA number. */
export const resolveSelfReportedLevel = ({
  authUser,
  personalDetails,
  loginResponse,
}: LevelSources): number | string | null => {
  const candidates = [
    authUser?.skillLevel,
    authUser?.skill_level,
    authUser?.usta_rating,
    personalDetails?.skillLevel,
    personalDetails?.skill_level,
    personalDetails?.usta_rating,
    loginResponse?.profile?.usta_rating,
    loginResponse?.skillLevel,
  ];
  return candidates.find(present) ?? null;
};

/**
 * The level to show the player. Computed first, self-reported as the fallback.
 * Returns "" rather than null so existing callers that expect a string keep working.
 */
export const resolvePlayerLevel = (sources: LevelSources): number | string =>
  resolveComputedNtrp(sources) ?? resolveSelfReportedLevel(sources) ?? "";

/**
 * A user object for the match creator, assembled from every store that holds part of one.
 *
 * The /create route reads localStorage directly rather than going through App.jsx's
 * buildMatchesUser, and "user" alone is not enough: it carries no calculated_ntrp, and
 * it may be absent entirely. Requiring it left MultiMatchCreatorFlow with no level and
 * no host id, because it reads both off this object.
 *
 * `authUser` is spread last so it still wins wherever it has a value; the other two only
 * fill gaps. `profile` is populated because the host-id lookup expects a nested object.
 * Returns null only when nothing at all is stored.
 */
export const buildLevelAwareUser = ({
  authUser,
  personalDetails,
  loginResponse,
}: LevelSources): LevelSourceRecord | null => {
  const loginProfile = loginResponse?.profile ?? null;
  const merged: LevelSourceRecord = { ...loginProfile, ...personalDetails, ...authUser };
  if (Object.keys(merged).length === 0) return null;

  const profile = authUser?.profile ?? personalDetails ?? loginProfile ?? null;
  if (profile) merged.profile = profile;

  const skillLevel = resolvePlayerLevel({ authUser, personalDetails, loginResponse });
  if (skillLevel) merged.skillLevel = skillLevel;

  return merged;
};
