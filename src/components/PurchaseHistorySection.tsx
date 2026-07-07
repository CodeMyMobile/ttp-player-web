import { getPackageCreditsRemaining, type PackagePurchase } from "../api/playerPackages";
import { usePackagePurchases } from "../hooks/usePackagePurchases";

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_DAYS = 14;

const isExpired = (purchase: PackagePurchase, now: number): boolean => {
  if (String(purchase.status ?? "").toLowerCase() === "expired") return true;
  if (purchase.expires_at) {
    const time = new Date(purchase.expires_at).getTime();
    return Number.isFinite(time) && time < now;
  }
  return false;
};

const daysUntil = (value: string | null | undefined, now: number): number | null => {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.ceil((time - now) / DAY_MS);
};

const formatDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// Truthful price: only render when amount_paid is genuinely present and positive —
// missing/zero amounts are omitted rather than shown as $0.
const formatAmount = (amount?: string, currency?: string) => {
  if (amount === undefined || amount === null || String(amount).trim() === "") return "";
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return "";
  const cur = (currency || "usd").toLowerCase();
  return cur === "usd" ? `$${num.toFixed(2)}` : `${num.toFixed(2)} ${cur.toUpperCase()}`;
};

const packageNameOf = (purchase: PackagePurchase) =>
  purchase.metadata?.package_snapshot?.name || "Lesson package";

const AvailableCard = ({ purchase, coachName, now }: {
  purchase: PackagePurchase;
  coachName: string;
  now: number;
}) => {
  const remaining = getPackageCreditsRemaining(purchase);
  const totalRaw = Number(purchase.credits_total ?? remaining);
  const total = Number.isFinite(totalRaw) && totalRaw > 0 ? totalRaw : remaining;
  const price = formatAmount(purchase.amount_paid, purchase.currency);
  const expiry = formatDate(purchase.expires_at);
  const days = daysUntil(purchase.expires_at, now);
  const expiringSoon = days !== null && days >= 0 && days <= EXPIRING_SOON_DAYS;

  return (
    <div className="ph-card">
      <div className="ph-card__head">
        <strong className="ph-card__name">{packageNameOf(purchase)}</strong>
        {price ? <span className="ph-card__price">{price}</span> : null}
      </div>
      {coachName ? <span className="ph-card__coach">with {coachName}</span> : null}

      <div className="ph-meter">
        {total <= 6 ? (
          <div className="ph-pips" aria-hidden="true">
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} className={`ph-pip${i < remaining ? " ph-pip--on" : ""}`} />
            ))}
          </div>
        ) : (
          <div className="ph-bar" aria-hidden="true">
            <div className="ph-bar__fill" style={{ width: `${Math.round((remaining / total) * 100)}%` }} />
          </div>
        )}
        <span className="ph-meter__label">
          {remaining} of {total} credit{total === 1 ? "" : "s"} left
        </span>
      </div>

      <div className="ph-card__foot">
        {expiry ? <span className="ph-card__expiry">Expires {expiry}</span> : null}
        {expiringSoon ? (
          <span className="ph-flag ph-flag--amber">
            Expires in {days} day{days === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {/* TODO(book-a-lesson): a "Use a credit" / "Book a lesson" CTA attaches here once
          the booking-from-credit entry point is wired. Intentionally omitted for now. */}
    </div>
  );
};

const PurchaseHistorySection = () => {
  const { purchases, coachNames, loading, error } = usePackagePurchases();
  const now = Date.now();

  const available: PackagePurchase[] = [];
  const past: PackagePurchase[] = [];
  for (const purchase of purchases) {
    if (!isExpired(purchase, now) && getPackageCreditsRemaining(purchase) > 0) available.push(purchase);
    else past.push(purchase);
  }

  return (
    <div className="settings-card">
      <h2 className="settings-card__title">Purchase history</h2>
      <p className="settings-card__subtitle">Lesson packages you've purchased, with their credit status.</p>

      {loading ? (
        <p className="ph-status">Loading your purchase history…</p>
      ) : error ? (
        <p className="ph-status ph-status--error">{error}</p>
      ) : purchases.length === 0 ? (
        <p className="ph-status">You haven't purchased any lesson packages yet.</p>
      ) : (
        <>
          {available.length > 0 ? (
            <section className="ph-group">
              <h3 className="ph-group__title">Available now</h3>
              <div className="ph-cards">
                {available.map((purchase, index) => (
                  <AvailableCard
                    key={String(purchase.id ?? `a-${index}`)}
                    purchase={purchase}
                    coachName={coachNames[String(purchase.coach_id)] || ""}
                    now={now}
                  />
                ))}
              </div>
            </section>
          ) : (
            <p className="ph-status">You have no active packages right now.</p>
          )}

          {past.length > 0 ? (
            <section className="ph-group">
              <h3 className="ph-group__title ph-group__title--muted">Past</h3>
              <ul className="ph-past-list">
                {past.map((purchase, index) => {
                  const expired = isExpired(purchase, now);
                  const coachName = coachNames[String(purchase.coach_id)] || "";
                  const price = formatAmount(purchase.amount_paid, purchase.currency);
                  return (
                    <li key={String(purchase.id ?? `p-${index}`)} className="ph-past-row">
                      <span className="ph-past-row__main">
                        {packageNameOf(purchase)}
                        {coachName ? ` · ${coachName}` : ""}
                      </span>
                      <span className="ph-past-row__meta">
                        <span className={`ph-past-status ph-past-status--${expired ? "expired" : "used"}`}>
                          {expired ? "Expired" : "Used up"}
                        </span>
                        {price ? ` · ${price}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
};

export default PurchaseHistorySection;
