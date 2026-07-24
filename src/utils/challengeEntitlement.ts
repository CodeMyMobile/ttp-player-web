// Single gate for "can this viewer initiate a challenge". Returns true for everyone
// today — it exists so a future paid tier can be enforced in ONE place (ladder rows,
// player profile, suggested strip all route through here) instead of scattering the
// check. Do not add product logic here without wiring the backing entitlement.
export type ChallengeViewer = {
  id?: number | string | null;
  isAuthenticated?: boolean;
} | null | undefined;

export const canChallenge = (_viewer?: ChallengeViewer): boolean => {
  // Future: return viewer?.entitlements?.includes("challenge") ?? false;
  return true;
};
