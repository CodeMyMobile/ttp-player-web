import type { PackagePurchase } from "../api/playerPackages";

// Shared package/credit derivation logic. Kept in one place because the same
// correctness rules now feed both the Credits page and the Profile hub's
// Purchases tab — duplicating them would drift. (Pure helpers only; no UI.)

export const formatPackageDate = (value?: string | null) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export interface CreditsSummary {
  total: number;
  used: number;
  remaining: number;
  /** Formatted date of the earliest upcoming expiry, or undefined when none. */
  nextExpiry?: string;
}

export const summarizeCredits = (purchases: PackagePurchase[]): CreditsSummary => {
  const totals = purchases.reduce(
    (acc, purchase) => {
      const total = Number(purchase.credits_total ?? 0);
      const used = Number(purchase.credits_used ?? 0);
      const remaining = Number(purchase.credits_remaining ?? 0);
      return {
        total: acc.total + (Number.isFinite(total) ? total : 0),
        used: acc.used + (Number.isFinite(used) ? used : 0),
        remaining: acc.remaining + (Number.isFinite(remaining) ? remaining : 0),
      };
    },
    { total: 0, used: 0, remaining: 0 },
  );

  const nextExpiry = purchases
    .map((purchase) => purchase.expires_at)
    .filter(Boolean)
    .map((value) => new Date(value as string))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return {
    ...totals,
    nextExpiry: nextExpiry ? formatPackageDate(nextExpiry.toISOString()) : undefined,
  };
};

// A purchase is "past" once it can no longer be used: no credits left, an
// expired/used/cancelled status, or an expiry date in the past. Undefined
// credits_remaining is NOT treated as zero — fall back to status/expiry so a
// freshly bought package missing that field isn't mis-filed as spent.
export const isPastPurchase = (purchase: PackagePurchase, now: number = Date.now()): boolean => {
  const remaining = purchase.credits_remaining;
  if (isFiniteNumber(remaining) && remaining <= 0) return true;

  const status = String(purchase.status ?? "").toLowerCase();
  if (status.includes("expired") || status.includes("used") || status.includes("cancel")) {
    return true;
  }

  if (purchase.expires_at) {
    const expiry = new Date(purchase.expires_at);
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < now) return true;
  }

  return false;
};

export const splitPurchases = (purchases: PackagePurchase[], now: number = Date.now()) => {
  const active: PackagePurchase[] = [];
  const past: PackagePurchase[] = [];
  for (const purchase of purchases) {
    (isPastPurchase(purchase, now) ? past : active).push(purchase);
  }
  return { active, past };
};

// Owned purchases carry no reliable display name (only ids + credit counts), so
// prefer a name on metadata and otherwise fall back to the coach context. Never
// fabricate a specific package name.
export const resolvePurchaseName = (purchase: PackagePurchase, coachName?: string): string => {
  const metadata = (purchase.metadata ?? {}) as Record<string, unknown>;
  const candidate = metadata.name ?? metadata.package_name ?? metadata.title;
  if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  return coachName ? `${coachName} · Lesson package` : "Lesson package";
};
