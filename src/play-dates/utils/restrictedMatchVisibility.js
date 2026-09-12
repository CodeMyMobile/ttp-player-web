/**
 * Whether a restricted match — private, or listed by link only — should be
 * hidden from a feed row the client has just fetched.
 *
 * The client cannot see other people's unlisted matches in the first place: the
 * API drops is_hidden rows unless the request asks for them, and it is only
 * asked on the tabs that are scoped to the viewer. This rule is the second half
 * of that, for rows that DID come back.
 *
 * `serverScopedToViewer` is the important argument. A request with filter=my is
 * joined against this player's own participant rows by the API, so membership is
 * already established before the row reaches us. Re-deriving it here can only
 * produce false negatives — the participant's player_id and the account id are
 * not always the same number in this data — and the cost of a false negative is
 * that a match you joined disappears from the one tab meant to list it.
 *
 * On an unscoped tab the derivation is all we have, so it still applies.
 */
export const shouldHideRestrictedMatch = ({
  isPrivate = false,
  isLinkOnly = false,
  isHost = false,
  isJoined = false,
  isInvited = false,
  serverScopedToViewer = false,
} = {}) => {
  if (!isPrivate && !isLinkOnly) return false;
  if (serverScopedToViewer) return false;
  return !isHost && !isJoined && !isInvited;
};
