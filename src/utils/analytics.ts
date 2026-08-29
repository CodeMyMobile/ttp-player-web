/**
 * Thin, provider-agnostic event tracking.
 *
 * PRIVACY — non-negotiable:
 * Log properties ABOUT the target, never the target. No player IDs, names, venues or
 * search text in any payload. `sameCourt: true` answers the question; `venue: "Penmar"`
 * builds a record of who looks at whom. The same applies to search: log `hasQuery: true`,
 * never the query itself.
 *
 * MEASUREMENT METHOD:
 * Any metric whose measurement method will change should carry the method as a property,
 * so that a step change in the number is attributable rather than mysterious. Hence
 * `rankingVersion: "none"` (a constant until ranking ships) and `venueMatch: "label"`
 * (label comparison under-reports, so the figure will jump when venue IDs land).
 * Prefer a version string over a boolean: a boolean that is always false gets deleted by
 * someone tidying up, a version string explains itself.
 *
 * INTENT vs COMPLETION:
 * `connect_clicked` is intent — it fires when Connect is tapped, before the profile
 * gate can intercept and before the player has done anything. `connect_sent` is the
 * completed action. Both carry identical properties, so the gap between them is the
 * gate's conversion rate; do not read `connect_clicked` as a count of connections made.
 *
 * No provider is wired yet, so `track` is a no-op. Call `setAnalyticsProvider` once at
 * startup when one is chosen; nothing at the call sites changes.
 */

export type AnalyticsValue = string | number | boolean | null;
export type AnalyticsProps = Record<string, AnalyticsValue>;
export type AnalyticsProvider = (event: string, props: AnalyticsProps) => void;

export const ANALYTICS_EVENTS = {
  findPlayersViewed: "find_players_viewed",
  filtersApplied: "filters_applied",
  connectClicked: "connect_clicked",
  connectSent: "connect_sent",
  profilePromptShown: "profile_prompt_shown",
  profilePromptClicked: "profile_prompt_clicked",
  matchProfileCompleted: "match_profile_completed",
  explainerOpened: "explainer_opened",
} as const;

/** Constant until a ranking exists. Becomes "v1" without the schema changing. */
export const RANKING_VERSION_NONE = "none";

/** How a venue comparison was made. Labels under-report; IDs will not. */
export const VENUE_MATCH_LABEL = "label";

let provider: AnalyticsProvider | null = null;

export const setAnalyticsProvider = (next: AnalyticsProvider | null) => {
  provider = next;
};

export const track = (event: string, props: AnalyticsProps = {}) => {
  if (!provider) {
    return;
  }
  try {
    provider(event, props);
  } catch {
    // Analytics must never break the page it is measuring.
  }
};
