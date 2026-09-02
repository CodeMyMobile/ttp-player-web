// Kill switch for the league contact actions.
//
// DEFAULT ON. Numbers were already exposed on this screen before this feature:
// the previous Players tab rendered `href="sms:+1310..."` on every row, so the
// full number sat in the page source. And joining a division is agreeing to be
// reachable by the players you are scheduled against. There is nothing here to
// hold back that was not already out.
//
// It stays a switch only so the surface can be turned off quickly without a
// revert — set VITE_LEAGUE_CONTACT_SHEET=0 (or "false" / "off") and redeploy.
//
// The join-flow opt-out checkbox is gated SEPARATELY, on isContactOptOutAvailable,
// because that one genuinely cannot work until the backend can persist
// `share_contact`. A checkbox that silently discards the user's choice is worse
// than no checkbox.

const readFlag = (name: string): string | undefined =>
  (import.meta.env as Record<string, string | undefined> | undefined)?.[name];

const isDisabled = (value: string | undefined): boolean =>
  value === "0" || value === "false" || value === "off";

export const isContactSheetEnabled = (): boolean =>
  !isDisabled(readFlag("VITE_LEAGUE_CONTACT_SHEET"));

/**
 * The join-flow checkbox letting a player opt OUT of sharing their number.
 * Off until the members payload carries `share_contact` and the join flow can
 * save it. Values: "1" or "true".
 */
export const isContactOptOutAvailable = (): boolean => {
  const raw = readFlag("VITE_LEAGUE_CONTACT_OPT_OUT");
  return raw === "1" || raw === "true";
};
