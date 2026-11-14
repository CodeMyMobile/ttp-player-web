/**
 * Home's "Action needed": one list of everything waiting on the player, soonest deadline first,
 * three shown before "See all".
 *
 *   league        a running season; its deadline is the season's end
 *   invite        a match invite to answer; its expiry, else the match start
 *   restring      a racket ready for pickup (no deadline on the order)
 *   rating        "Confirm your 4.5" while unrated (no deadline)
 *   restringNudge "Time for a restring?" (no deadline, always below everything else)
 *
 * Pure, so it's tested without rendering.
 */
import type { HomeAlert } from "./homeAlertStack";
import { inviteDetails, inviteDetailsPath, type HomeInviteItem } from "./homeInvite";

export const ACTION_PREVIEW_COUNT = 3;

export interface ActionRow {
  key: string;
  kind: "invite" | "restring" | "restringNudge";
  title: string;
  /** "Sat, Nov 14 · 9:00 AM · Penmar Park"; null when there's nothing verifiable to say. */
  detail: string | null;
  /** Epoch ms of the deadline; null sorts last. */
  deadlineAt: number | null;
  href: string | null;
  cta: string;
}

const epoch = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

const inviteRow = (invite: HomeInviteItem): ActionRow => {
  const { description, when, where } = inviteDetails(invite);
  return {
    key: `invite-${invite.id}`,
    kind: "invite",
    title: `${invite.senderName} wants to play`,
    detail: [description, when, where].filter(Boolean).join(" · ") || null,
    // The invite's expiry is its real deadline; without one, the match start is.
    deadlineAt: epoch(invite.deadlineAt) ?? epoch(invite.startsAt),
    href: inviteDetailsPath(invite),
    cta: "Respond",
  };
};

const alertRow = (alert: HomeAlert): ActionRow => ({
  key: alert.id,
  kind: "restring",
  title: alert.type === "restring_pickup" ? `Racket ${alert.title.toLowerCase()}` : alert.title,
  detail: alert.subtitle,
  deadlineAt: alert.deadlineAt,
  href: alert.destination,
  cta: "View",
});

/**
 * "Time for a restring?": once the last picked-up restring is this many weeks old, or the player
 * has played this many matches and lessons since it (ttp-api GET /players/me/activity-count),
 * whichever comes first.
 */
export const RESTRING_NUDGE_WEEKS = 8;
export const RESTRING_NUDGE_MATCHES = 20;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// A restring the shop still has, or one waiting to be collected: no nudge while it's in hand.
const OPEN_ORDER_STATUSES = new Set(["pending", "dropped_off", "in_progress", "ready_for_pickup"]);
const DONE_ORDER_STATUSES = new Set(["picked_up", "fulfilled"]);

type Order = Record<string, unknown>;

const lower = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");
// Two status columns, and only one is filled on some rows (homeAlertStack reads both too).
const orderStatuses = (order: Order) => [lower(order.fulfillment_status), lower(order.status)];
const isRestringItem = (item: unknown) => {
  const row = (item ?? {}) as Order;
  return row.item_type !== "custom" && row.item_type !== "racket" && Boolean(row.service_tier_id);
};
const hasRestring = (order: Order) => Array.isArray(order.items) && order.items.some(isRestringItem);
const doneAt = (order: Order) => epoch(order.picked_up_at) ?? epoch(order.fulfilled_at) ?? epoch(order.created_at);

/**
 * When the last restring was picked up, as an epoch; null with none on record, or "open" while one
 * is still at the shop or waiting to be collected.
 */
export const lastRestrungAt = (orders: unknown): number | null | "open" => {
  const list = (Array.isArray(orders) ? orders : []).filter((order): order is Order => Boolean(order));
  const restrings = list.filter(hasRestring);
  if (restrings.some((order) => orderStatuses(order).some((status) => OPEN_ORDER_STATUSES.has(status)))) return "open";
  const last = Math.max(
    ...restrings
      .filter((order) => orderStatuses(order).some((status) => DONE_ORDER_STATUSES.has(status)))
      .map((order) => doneAt(order) ?? -Infinity),
  );
  return Number.isFinite(last) ? last : null;
};

export interface PlayedSinceRestring {
  matches: number;
  lessons: number;
}

const playedLine = ({ matches, lessons }: PlayedSinceRestring) => {
  const total = matches + lessons;
  return lessons > 0 ? `${total} matches and lessons since` : `${total} matches since`;
};

/**
 * The nudge row, or null: no restring on record, one still open, or neither half of the rule met.
 * `played` is the count since the last restring, when it has loaded.
 */
export const restringNudgeRow = (orders: unknown, now: number, played: PlayedSinceRestring | null = null): ActionRow | null => {
  const last = lastRestrungAt(orders);
  // Nothing to measure from (never restrung with us), or a restring still in hand.
  if (last === null || last === "open") return null;
  const weeks = Math.floor((now - last) / WEEK_MS);
  const playedEnough = played !== null && played.matches + played.lessons >= RESTRING_NUDGE_MATCHES;
  if (weeks < RESTRING_NUDGE_WEEKS && !playedEnough) return null;
  const detail =
    weeks >= RESTRING_NUDGE_WEEKS
      ? `Last restrung ${weeks} weeks ago${playedEnough && played ? ` · ${playedLine(played)}` : ""}`
      : `${playedLine(played as PlayedSinceRestring)} your last restring`;
  return {
    key: "restring-nudge",
    kind: "restringNudge",
    title: "Time for a restring?",
    detail,
    deadlineAt: null,
    href: "/restring",
    cta: "Book restring",
  };
};

/** Invites, pickups and the restring nudge, as rows. Ordering is buildActionItems' job. */
export const buildActionRows = ({
  invites = [],
  alerts = [],
  restringOrders = [],
  playedSinceRestring = null,
  now = Date.now(),
}: {
  invites?: HomeInviteItem[];
  alerts?: HomeAlert[];
  restringOrders?: unknown[];
  /** Matches and lessons since the last restring (useRestringActivity); null until loaded. */
  playedSinceRestring?: PlayedSinceRestring | null;
  now?: number;
}): ActionRow[] => {
  const nudge = restringNudgeRow(restringOrders, now, playedSinceRestring);
  return sortByDeadline(
    [
      ...invites.filter(Boolean).map(inviteRow),
      ...alerts.filter((alert) => alert?.type === "restring_pickup").map(alertRow),
      ...(nudge ? [nudge] : []),
    ].map((row) => ({ item: row, deadlineAt: row.deadlineAt, tier: row.kind === "restringNudge" ? 2 : 0 })),
  );
};

export interface RatingCard {
  title: string;
  sub: string;
  href: string;
}

export type ActionItem<Season> =
  | { kind: "league"; key: string; season: Season }
  | { kind: "rating"; key: string; prompt: RatingCard }
  | { kind: "row"; key: string; row: ActionRow };

/**
 * Soonest deadline first. Without one: things to do (a racket to collect) first, then the
 * rating card, then the restring nudge, which sits below everything. Stable otherwise.
 */
const sortByDeadline = <T>(entries: { item: T; deadlineAt: number | null; tier: number }[]): T[] =>
  entries
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => {
      const delta = (a.deadlineAt ?? Infinity) - (b.deadlineAt ?? Infinity);
      if (delta && !Number.isNaN(delta)) return delta;
      return a.tier - b.tier || a.index - b.index;
    })
    .map(({ item }) => item);

/** The whole section, in order. Show the first ACTION_PREVIEW_COUNT, the rest behind "See all". */
export const buildActionItems = <Season extends { id: string; endDate: string | null }>({
  seasons = [],
  prompt = null,
  rows = [],
}: {
  seasons?: Season[];
  prompt?: RatingCard | null;
  rows?: ActionRow[];
}): ActionItem<Season>[] =>
  sortByDeadline<ActionItem<Season>>([
    ...seasons.map((season) => ({
      item: { kind: "league" as const, key: `league-${season.id}`, season },
      deadlineAt: epoch(season.endDate),
      tier: 0,
    })),
    ...(prompt ? [{ item: { kind: "rating" as const, key: "rating", prompt }, deadlineAt: null, tier: 1 }] : []),
    ...rows.map((row) => ({
      item: { kind: "row" as const, key: row.key, row },
      deadlineAt: row.deadlineAt,
      tier: row.kind === "restringNudge" ? 2 : 0,
    })),
  ]);
