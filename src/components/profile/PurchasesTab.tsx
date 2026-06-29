import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Loader2, Package, Wallet } from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { getStoredAuthToken } from "../../services/authToken";
import { getPlayerCoaches, type PlayerCoach } from "../../api/playerCalendar";
import { fetchPackageCredits, type PackagePurchase } from "../../api/playerPackages";
import StateBanner from "../coaches/StateBanner";
import {
  formatPackageDate,
  resolvePurchaseName,
  splitPurchases,
  summarizeCredits,
} from "../../utils/packageCredits";

// A purchase paired with the coach it belongs to. Credits are stored per-coach
// (there is no global credits endpoint), so the ledger is assembled by fanning
// out fetchPackageCredits across the player's coaches and tagging each result.
type OwnedPurchase = PackagePurchase & { __coachName?: string };

const pickCoachId = (coach: PlayerCoach) => {
  const record = coach as Record<string, unknown>;
  return record.coach_id ?? coach.id ?? record.user_id ?? record.player_coach_id ?? null;
};

const resolveCoachName = (coach: PlayerCoach) => {
  const record = coach as Record<string, unknown>;
  const parts = [
    record.full_name,
    record.fullName,
    record.coach_name,
    record.name,
    [record.first_name, record.last_name].filter(Boolean).join(" ").trim(),
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  return parts[0] || "Coach";
};

const creditsProgress = (purchase: PackagePurchase) => {
  const total = Number(purchase.credits_total ?? 0);
  const remaining = Number(purchase.credits_remaining ?? 0);
  if (!Number.isFinite(total) || total <= 0) return 0;
  const pct = (Math.max(0, remaining) / total) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
};

const PurchasesTab = () => {
  const { user } = useAuth();
  const authToken = useMemo(
    () =>
      user?.session?.access_token ??
      user?.access_token ??
      user?.token ??
      getStoredAuthToken({ preferScheme: "token" }) ??
      undefined,
    [user],
  );

  const [purchases, setPurchases] = useState<OwnedPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // How many coaches' credit fetches failed. Non-zero means the totals below
  // are a partial view, so we say so rather than presenting an undercount as
  // authoritative on a record surface.
  const [failedCoachCount, setFailedCoachCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!authToken) {
      setPurchases([]);
      setFailedCoachCount(0);
      setError("Sign in to view your lesson purchases.");
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);
    setFailedCoachCount(0);

    (async () => {
      try {
        const coaches = await getPlayerCoaches({ perPage: 50, page: 1 });
        const withIds = coaches
          .map((coach) => ({ id: pickCoachId(coach), name: resolveCoachName(coach) }))
          .filter((entry): entry is { id: NonNullable<typeof entry.id>; name: string } => entry.id != null);

        // Fan out per coach; tolerate individual failures so one bad coach
        // doesn't blank the whole ledger.
        const results = await Promise.allSettled(
          withIds.map((entry) =>
            fetchPackageCredits({ token: authToken, coachId: entry.id, includeExpired: true }).then(
              (response) =>
                (response?.purchases ?? []).map((purchase) => ({
                  ...purchase,
                  __coachName: entry.name,
                })),
            ),
          ),
        );

        if (cancelled) return;

        const owned = results.flatMap((result) =>
          result.status === "fulfilled" ? result.value : [],
        );
        setFailedCoachCount(results.filter((result) => result.status === "rejected").length);
        setPurchases(owned);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load your purchases.");
        setPurchases([]);
        setFailedCoachCount(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const summary = useMemo(() => summarizeCredits(purchases), [purchases]);
  const { active, past } = useMemo(() => splitPurchases(purchases), [purchases]);

  const renderPackageCard = (purchase: OwnedPurchase, variant: "active" | "past") => {
    const name = resolvePurchaseName(purchase, purchase.__coachName);
    const total = Number(purchase.credits_total ?? 0);
    const remaining = Number(purchase.credits_remaining ?? 0);
    const purchased = formatPackageDate(purchase.purchased_at);
    const expires = formatPackageDate(purchase.expires_at);

    return (
      <article
        key={String(purchase.id ?? `${name}-${purchase.purchased_at ?? ""}`)}
        className={`purchases-package purchases-package--${variant}`}
      >
        <div className="purchases-package__head">
          <h3 className="purchases-package__name">{name}</h3>
          <span className="purchases-package__count">
            {Number.isFinite(remaining) ? remaining : 0}
            {Number.isFinite(total) && total > 0 ? ` / ${total}` : ""} credits
          </span>
        </div>
        <div className="match-profile-progress__track purchases-package__track">
          <div
            className="match-profile-progress__bar"
            style={{ width: `${creditsProgress(purchase)}%` }}
          />
        </div>
        <dl className="purchases-package__meta">
          {purchased ? (
            <div>
              <dt>Purchased</dt>
              <dd>{purchased}</dd>
            </div>
          ) : null}
          {expires ? (
            <div>
              <dt>{variant === "past" ? "Expired" : "Expires"}</dt>
              <dd>{expires}</dd>
            </div>
          ) : null}
        </dl>
      </article>
    );
  };

  return (
    <>
      <header className="settings-hero settings-hero--billing">
        <span className="settings-hero__badge">
          <Wallet size={16} aria-hidden="true" />
          Lesson account
        </span>
        <h1 className="settings-hero__title">Purchases</h1>
        <p className="settings-hero__subtitle">
          Your lesson credits and packages. See how many sessions you have left and when they expire.
        </p>
      </header>

      {loading ? (
        <section className="settings-section">
          <div className="match-profile-empty">
            <Loader2 size={28} className="purchases-spinner" aria-hidden="true" />
            <h3>Loading your purchases…</h3>
          </div>
        </section>
      ) : error ? (
        <section className="settings-section">
          <StateBanner tone="error" title="Couldn’t load your purchases" message={error} />
        </section>
      ) : (
        <section className="settings-section">
          {failedCoachCount > 0 ? (
            <p className="purchases-incomplete" role="status">
              Couldn’t load credits from {failedCoachCount === 1 ? "one coach" : `${failedCoachCount} coaches`} — totals may be incomplete.
            </p>
          ) : null}

          <div className="purchases-metrics">
            <div className="purchases-metric">
              <span className="purchases-metric__value">{summary.remaining}</span>
              <span className="purchases-metric__label">Lessons remaining</span>
            </div>
            <div className="purchases-metric">
              <span className="purchases-metric__value">{active.length}</span>
              <span className="purchases-metric__label">Active packages</span>
            </div>
            <div className="purchases-metric">
              <span className="purchases-metric__value">{summary.nextExpiry ?? "—"}</span>
              <span className="purchases-metric__label">Next expiry</span>
            </div>
          </div>

          <div className="settings-card">
            <div className="purchases-card__head">
              <div>
                <h2 className="settings-card__title">Active packages</h2>
                <p className="settings-card__subtitle">Credits you can use to book lessons.</p>
              </div>
              <Link to="/credits" className="match-profile-inline-button match-profile-inline-button--primary">
                <Package size={16} aria-hidden="true" />
                Buy lessons
              </Link>
            </div>

            {active.length > 0 ? (
              <div className="purchases-package-list">
                {active.map((purchase) => renderPackageCard(purchase, "active"))}
              </div>
            ) : (
              <StateBanner
                tone="empty"
                title="No active packages"
                message="When you buy a lesson package, your credits will show up here."
              />
            )}

            {/* Receipts have no download/invoice endpoint today; they're emailed
                at purchase time. Stated plainly rather than implying a download. */}
            <p className="purchases-note billing-note">
              <CalendarClock size={14} aria-hidden="true" /> Receipts are emailed when you purchase.
            </p>
          </div>

          {past.length > 0 ? (
            <div className="settings-card">
              <h2 className="settings-card__title">Past packages</h2>
              <p className="settings-card__subtitle">Packages you’ve used up or that have expired.</p>
              <div className="purchases-package-list">
                {past.map((purchase) => renderPackageCard(purchase, "past"))}
              </div>
            </div>
          ) : null}

          {/* Payment history seam — intentionally unmounted. A PaymentHistory
              section will mount here once a transactions/receipts endpoint
              exists (none today). No placeholder rows by design. */}
        </section>
      )}
    </>
  );
};

export default PurchasesTab;
