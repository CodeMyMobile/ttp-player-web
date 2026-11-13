/**
 * The rows in home's "Action needed": pending match invites and rackets ready for pickup,
 * soonest deadline first, three shown before "See all". League cards and the confirm-rating
 * card sit above these rows and aren't counted in them.
 *
 * Pure, so it's tested without rendering.
 */
import type { HomeAlert } from "./homeAlertStack";
import { inviteDetails, inviteDetailsPath, type HomeInviteItem } from "./homeInvite";

export const ACTION_PREVIEW_COUNT = 3;

export interface ActionRow {
  key: string;
  kind: "invite" | "restring";
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

/** Soonest deadline first; no deadline last; stable within equal keys. */
export const buildActionRows = ({
  invites = [],
  alerts = [],
}: {
  invites?: HomeInviteItem[];
  alerts?: HomeAlert[];
}): ActionRow[] =>
  [
    ...invites.filter(Boolean).map(inviteRow),
    ...alerts.filter((alert) => alert?.type === "restring_pickup").map(alertRow),
  ]
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const delta = (a.row.deadlineAt ?? Infinity) - (b.row.deadlineAt ?? Infinity);
      return Number.isNaN(delta) || delta === 0 ? a.index - b.index : delta;
    })
    .map(({ row }) => row);
