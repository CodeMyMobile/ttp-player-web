// Which invite the home card shows, and how many it is standing in front of.
//
// All the branching lives here rather than in the component: there is no React
// test harness in this repo, so logic that isn't in a pure function isn't tested
// at all.

export interface HomeInviteItem {
  id: string | number;
  token: string | null;
  senderName: string;
  initials: string;
  avatarUrl?: string | null;
  description?: string | null;
  whenLabel?: string | null;
  locationLabel?: string | null;
  expiresLabel?: string | null;
  /** Epoch ms of the match start, or null when the record carried no parseable one. */
  startsAt?: number | null;
  deadlineAt?: string | null;
  [key: string]: unknown;
}

export interface HomeInviteSelection {
  /** The one invite to render, or null when there are none. */
  invite: HomeInviteItem | null;
  /** How many others are waiting behind it. Zero means no "N more" link. */
  remaining: number;
}

const startKey = (invite: HomeInviteItem): number => {
  if (typeof invite?.startsAt === "number" && Number.isFinite(invite.startsAt)) {
    return invite.startsAt;
  }
  // Fall back to the expiry, which is at least a real deadline. An invite with
  // neither sorts last rather than jumping the queue on a zero.
  const deadline = invite?.deadlineAt ? new Date(invite.deadlineAt).getTime() : NaN;
  return Number.isFinite(deadline) ? deadline : Number.POSITIVE_INFINITY;
};

/**
 * Soonest match first.
 *
 * GET /invites returns created_at DESC, which orders by when someone happened to
 * press send — no relation to which match needs an answer first. Sorting is
 * therefore not a nicety; the unsorted first row is close to arbitrary.
 *
 * Stable within equal keys, so two invites at the same time keep server order
 * instead of shuffling between renders.
 */
export const sortInvitesBySoonest = (invites: HomeInviteItem[]): HomeInviteItem[] =>
  (Array.isArray(invites) ? invites.filter(Boolean) : [])
    .map((invite, index) => ({ invite, index }))
    .sort((a, b) => {
      const delta = startKey(a.invite) - startKey(b.invite);
      return delta !== 0 ? delta : a.index - b.index;
    })
    .map((entry) => entry.invite);

/**
 * The soonest invite plus a count of the rest.
 *
 * Only one card ever renders — two stacked violet cards would dominate the
 * screen and bury everything under them. The remainder becomes a link.
 */
export const selectHomeInvite = (invites: HomeInviteItem[]): HomeInviteSelection => {
  const sorted = sortInvitesBySoonest(invites);
  return {
    invite: sorted[0] ?? null,
    remaining: Math.max(0, sorted.length - 1),
  };
};

/** "2 more invites" / "1 more invite", or null when there is nothing more. */
export const moreInvitesLabel = (remaining: number): string | null => {
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  return `${remaining} more invite${remaining === 1 ? "" : "s"}`;
};

/**
 * "Decline this match? Mike will be notified."
 *
 * Deliberately "notified" and never "will get a text". POST /invites/reject does
 * SMS the organiser, but the send sits in its own try/catch with the error
 * swallowed, and the response is always { message: 'Invite rejected' } — so the
 * client cannot know a text arrived, and must not say one did.
 *
 * First name only, matching the mockup. Falls back to a name-free sentence
 * rather than printing "undefined will be notified".
 */
export const declinePromptFor = (invite: HomeInviteItem | null): string => {
  const full = typeof invite?.senderName === "string" ? invite.senderName.trim() : "";
  const first = full.split(/\s+/).filter(Boolean)[0];
  return first
    ? `Decline this match? ${first} will be notified.`
    : "Decline this match? They will be notified.";
};

/**
 * The card's sub-line: "4.0 Flex · Sat 9 Aug, 10 AM · Penmar", minus whatever is
 * missing. Null when every part is missing, so the line is omitted rather than
 * rendered as stray separators.
 */
export const inviteMetaLabel = (invite: HomeInviteItem | null): string | null => {
  const parts = [invite?.description, invite?.whenLabel, invite?.locationLabel].filter(
    (part): part is string => typeof part === "string" && part.trim() !== "",
  );
  return parts.length ? parts.join(" · ") : null;
};
