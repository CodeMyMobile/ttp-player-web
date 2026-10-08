// Match waitlist state, read from the match payload described in
// docs/match-waitlist-backend-brief.md.
//
// `waitlist_count` being a number is the signal that the backend supports the
// waitlist at all. While it is absent every flag below is false, so no waitlist
// UI is shown and nothing is promised that the server does not do.

const toCount = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
  }
  return null;
};

export const readMatchWaitlist = (match) => {
  const count = toCount(match?.waitlist_count);
  if (count === null) {
    return { supported: false, count: 0, position: null, hold: false, open: false, entries: null };
  }
  const position = toCount(match.waitlist_position);
  return {
    supported: true,
    count,
    position: position && position > 0 ? position : null,
    hold: match.waitlist_hold === true,
    open: match.waitlist_open === true,
    // Names are sent to the organiser only; for everyone else the key is absent.
    entries: Array.isArray(match.waitlist) ? match.waitlist : null,
  };
};

export const getMatchWaitlistState = ({
  waitlist,
  isFull,
  isHost,
  isJoined,
  isActive,
  hasAccess,
}) => {
  const supported = Boolean(waitlist?.supported) && isActive;
  const isWaitlisted = supported && !isJoined && waitlist.position !== null;
  const seatFree = supported && !isFull;
  // A seat that opens while people are waiting is held for them, so a player
  // who is not waiting queues behind them rather than taking it.
  const seatHeld = seatFree && waitlist.hold;
  const isOpenToWaitlist = seatFree && waitlist.open;

  return {
    supported,
    count: supported ? waitlist.count : 0,
    position: isWaitlisted ? waitlist.position : null,
    isWaitlisted,
    seatHeld,
    isOpenToWaitlist,
    canJoin:
      supported && !isHost && !isJoined && !isWaitlisted && hasAccess && (isFull || seatHeld),
    canLeave: isWaitlisted,
    canClaim: isWaitlisted && isOpenToWaitlist,
    awaitingOrganiser: isWaitlisted && seatFree && !isOpenToWaitlist,
    entries: supported && isHost && waitlist.entries ? waitlist.entries : null,
    hostCanPromote: supported && isHost && seatFree,
    hostCanOpen: supported && isHost && seatFree && waitlist.count > 0 && !isOpenToWaitlist,
  };
};

export const formatWaitlistCount = (count) =>
  count > 0 ? `${count} on the waitlist` : "";

export const formatWaitlistStanding = (position, count) =>
  count > 1 ? `You're #${position} of ${count} on the waitlist` : `You're #${position} on the waitlist`;
