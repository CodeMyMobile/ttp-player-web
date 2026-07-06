import moment from "moment";

import { normalizeMatchRecord } from "../api/matches";

// Home-screen Alerts model. Discriminated union: "invitation" | "match_needs_players".
// Every alert normalizes to { id, type, leadingVisual, title, metaLines[], deadlineAt, open() }
// plus the extra fields each type needs for actions. Truthful-UI: builders never
// fabricate — a missing field omits its line, and un-derivable alerts are dropped.

// One tunable urgency helper. >48h neutral, ≤48h amber, ≤24h red.
// Labels: "5d left" (≥48h) / "14h left" (<48h). null when there's no real deadline.
export function alertUrgency(deadlineAt, now = Date.now()) {
  if (!deadlineAt) return null;
  const ms = new Date(deadlineAt).getTime();
  if (Number.isNaN(ms)) return null;
  const diff = ms - now;
  if (diff <= 0) return { tone: "red", label: "Expired" };
  const hours = diff / 3_600_000;
  const tone = hours <= 24 ? "red" : hours <= 48 ? "amber" : "neutral";
  const label = hours >= 48 ? `${Math.round(hours / 24)}d left` : `${Math.max(1, Math.round(hours))}h left`;
  return { tone, label };
}

// An avatar URL is only usable if it points at an actual file/key — the backend
// sometimes returns just the bucket root ("https://…amazonaws.com/"), which renders
// a broken image; treat that as null so the initials fallback shows instead.
export function usableAvatar(url) {
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
    return lastSegment ? url : null;
  } catch {
    return url; // relative/non-URL string — leave as-is
  }
}

// Map an already-normalized dashboard invite item → an "invitation" alert.
// The invite item is the real, deduped shape the old card consumed; we add
// deadlineAt (raw expiry) + condensed rowMeta for the collapsed rows.
export function inviteToAlert(item) {
  if (!item) return null;
  const whenWhere = [item.whenLabel, item.locationLabel].filter(Boolean).join(" · ");
  return {
    id: `invite-${item.id}`,
    type: "invitation",
    inviteKind: item.inviteKind, // "player" | "coach" — drives the accept/decline path
    leadingVisual: {
      kind: "avatar",
      url: usableAvatar(item.avatarUrl),
      initials: item.initials,
      accent: item.accentClassName || "player",
    },
    title: item.senderName,
    subtitle: item.description || null,
    metaLines: Array.isArray(item.chips) ? item.chips : [],
    // Condensed lines for the collapsed row: what, then when · where (real fields only).
    rowMeta: [item.description || null, whenWhere || null].filter(Boolean),
    isLeague: Boolean(item.isLeague),
    leagueId: item.leagueId ?? null,
    deadlineAt: item.deadlineAt || null, // real expiry (player invites) or null (coach: no true expiry)
    typeLabel: item.typeLabel || null,
    destination: item.destination || null,
    // action payload (reuse existing handleInviteAction)
    token: item.token || null,
    lessonId: item.lessonId || null,
    pendingAction: item.pendingAction || null,
    expiresLabel: item.expiresLabel || null,
    // Flex-events shape (future): present later; single-value case renders today.
    timeOptions: Array.isArray(item.time_options) ? item.time_options : null,
    locationOptions: Array.isArray(item.location_options) ? item.location_options : null,
    raw: item,
  };
}

// Derive "hosted match needs players" alerts from the already-fetched my/upcoming
// matches. Truthful gate: only emit when we can actually see an unfilled slot on a
// hosted, future match — otherwise render nothing (no fabricated "needs players").
export function deriveMatchNeedsAlerts(matches, user, now = Date.now()) {
  if (!Array.isArray(matches)) return [];
  return matches
    .map((record) => {
      const m = normalizeMatchRecord(record, { currentUser: user });
      if (!m || m.relationship !== "host") return null;
      const needed = Number(m.playersNeeded);
      if (!Number.isFinite(needed) || needed <= 0) return null; // no capacity data → no alert
      if (!m.startDateTimeIso) return null;
      const startMs = new Date(m.startDateTimeIso).getTime();
      if (Number.isNaN(startMs) || startMs <= now) return null; // future only
      const metaLines = [m.startDisplay || null, m.location || null].filter(Boolean);
      return {
        id: `hostneed-${m.id}`,
        type: "match_needs_players",
        leadingVisual: { kind: "tile" },
        title: `Your match needs ${needed} more player${needed === 1 ? "" : "s"}`,
        subtitle: m.format || null,
        metaLines,
        rowMeta: metaLines,
        deadlineAt: m.startDateTimeIso, // warning deadline = match start
        isLeague: Boolean(m.raw?.is_league_match),
        leagueId: m.raw?.league_id ?? null,
        // League matches deep-link to the league; casual matches to the match.
        destination:
          m.raw?.is_league_match && m.raw?.league_id != null
            ? `/leagues/${m.raw.league_id}`
            : m.id != null
              ? `/matches/${m.id}`
              : null,
        raw: m,
      };
    })
    .filter(Boolean);
}

// Sort ascending by deadlineAt (most urgent first) across all types.
// Alerts without a real deadline (e.g. coach invites) sort last.
export function sortAlerts(alerts) {
  return [...alerts].sort((a, b) => {
    const am = a.deadlineAt ? new Date(a.deadlineAt).getTime() : Infinity;
    const bm = b.deadlineAt ? new Date(b.deadlineAt).getTime() : Infinity;
    if (am !== bm) return am - bm;
    return 0;
  });
}

// Short "when" summary for flex-events (shape only today): single value renders now,
// a proposed-options list summarizes as "3 times proposed".
export function summarizeWhen(alert) {
  if (alert?.timeOptions && alert.timeOptions.length > 1) {
    return `${alert.timeOptions.length} times proposed`;
  }
  return null;
}

export { moment };
