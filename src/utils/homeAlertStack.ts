// The v2 home alert stack — the divided list that sits between the today row
// and the action grid.
//
// Deliberately separate from utils/homeAlerts.js, which models the *legacy*
// DashboardPage alerts ("invitation" | "match_needs_players"). Different types,
// different screen, and sharing the file would let a change here break the old
// dashboard. Conventions are borrowed rather than the code: the same
// { id, type, title, subtitle, destination } shape, and the same rule that a
// builder never fabricates — a field we cannot read omits its line, and an
// alert we cannot derive is not emitted at all.

import { orderStatusLabel } from "../restringing/playerFlow";

/**
 * "booking_reminder" is deliberately absent. The brief lists one, but no state
 * mockup contains such a row — the today row above the stack, with its red
 * clock chip, is that reminder. Adding a second one here would duplicate it.
 *
 * "unentered_score" is in the union so the component can render the type, but
 * nothing in this module emits it: there is no endpoint behind it. See the
 * omissions table in the build brief.
 */
export type HomeAlertType = "restring_pickup" | "unentered_score";

export type HomeAlertTone = "violet" | "amber";

export interface HomeAlert {
  id: string;
  type: HomeAlertType;
  tone: HomeAlertTone;
  title: string;
  /** Null when we have nothing verifiable to say — never "" or a placeholder. */
  subtitle: string | null;
  destination: string | null;
  /** Epoch ms, for ordering. Null sorts last. */
  deadlineAt: number | null;
}

const text = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

const READY = "ready_for_pickup";

/**
 * An order is collectable when either status field says so. The two are
 * separate columns and only one is populated on some rows, so this reads both
 * rather than guessing which the backend maintains.
 */
const isReadyForPickup = (order: Record<string, unknown>) => {
  const status = text(order.status)?.toLowerCase();
  const fulfillment = text(order.fulfillment_status)?.toLowerCase();
  return status === READY || fulfillment === READY;
};

/**
 * Restring orders → "Ready for pickup" rows.
 *
 * The mockup's sub-line reads "Tennis Garage · Penmar", but an order carries
 * vendor_name and no location field of any kind — RestringingPlayerFlow reads
 * id, status, fulfillment_status, vendor_name, items, payment_status and
 * total_cents, and that is the whole shape. So the vendor ships alone and the
 * "· Penmar" half is dropped rather than invented. It needs a backend field
 * before it can be honest.
 */
export const restringPickupAlerts = (orders: unknown[]): HomeAlert[] =>
  (Array.isArray(orders) ? orders : []).flatMap((raw) => {
    const order = raw as Record<string, unknown>;
    if (!order || !isReadyForPickup(order)) return [];

    const id = order.id;
    if (id == null || id === "") return [];

    return [
      {
        id: `restring-${String(id)}`,
        type: "restring_pickup" as const,
        tone: "violet" as const,
        // Reuse the existing map so the copy stays one string, not two.
        title: orderStatusLabel(READY),
        subtitle: text(order.vendor_name),
        destination: "/restring",
        // Nothing on the order says when it must be collected by.
        deadlineAt: null,
      },
    ];
  });

/** Most urgent first; alerts with no real deadline keep their relative order at the end. */
export const sortHomeAlerts = (alerts: HomeAlert[]): HomeAlert[] =>
  [...(Array.isArray(alerts) ? alerts : [])].sort((a, b) => {
    const left = a.deadlineAt ?? Infinity;
    const right = b.deadlineAt ?? Infinity;
    return left - right;
  });

/**
 * Everything the stack should show, in order. Empty array means render nothing
 * — the caller must not reserve space for a stack that has no rows.
 */
export const buildHomeAlerts = ({ restringOrders = [] }: { restringOrders?: unknown[] } = {}) =>
  sortHomeAlerts(restringPickupAlerts(restringOrders));
