// Feature flags for the play-dates (matches) sub-app.
//
// VITE_MULTI_MATCH gates the new multi-match creation flow. Default OFF: when
// unset/false the legacy single-match MatchCreatorFlow renders unchanged, so the
// "flag off = identical to today" guarantee is structural.
const truthy = (value) =>
  value === true ||
  value === "1" ||
  value === "true" ||
  value === "on" ||
  value === "yes";

export const isMultiMatchEnabled = () =>
  truthy(import.meta.env?.VITE_MULTI_MATCH);
