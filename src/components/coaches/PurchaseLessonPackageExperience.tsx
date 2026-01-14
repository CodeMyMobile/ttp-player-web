import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  Package,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";

import type { CoachProfileRecord } from "../../api/coachProfile";
import {
  fetchCoachPackages,
  fetchPackageCredits,
  purchaseCoachPackage,
  type CoachPackage,
  type PackagePurchase,
} from "../../api/playerPackages";
import { getPlayerStripePaymentMethods, type PlayerStripePaymentMethod } from "../../api/playerStripe";
import { useAuth } from "../../context/AuthContext";
import { getStoredAuthToken } from "../../services/authToken";

import "./PurchaseLessonPackageExperience.css";

type PurchaseLessonPackagePresentation = "modal" | "page";

type PurchaseLessonPackageExperienceProps = {
  coach: CoachProfileRecord;
  onClose?: () => void;
  presentation?: PurchaseLessonPackagePresentation;
};

type PurchaseState = "idle" | "processing" | "success";

type PaymentMethodPayload =
  | PlayerStripePaymentMethod[]
  | {
      payment_methods?: PlayerStripePaymentMethod[];
      data?: PlayerStripePaymentMethod[];
      results?: PlayerStripePaymentMethod[];
      paymentMethods?: PlayerStripePaymentMethod[];
      default_payment_method_id?: string;
      default_payment_method?: string;
      defaultPaymentMethodId?: string;
      [key: string]: unknown;
    }
  | null
  | undefined;

const formatCurrency = (value?: number | string | null) => {
  const numeric = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(numeric)) {
    return undefined;
  }
  try {
    return numeric.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });
  } catch {
    return `$${numeric}`;
  }
};

const normalizeLessonTypeLabel = (lessonTypes?: string[]) => {
  const label = lessonTypes?.[0];
  if (!label) return "package";
  const normalized = label.replace(/[_-]+/g, " ").trim();
  return normalized || "package";
};

const formatLessonTypeList = (lessonTypes?: string[]) => {
  if (!lessonTypes || lessonTypes.length === 0) return "All lesson types";
  if (lessonTypes.length === 1) return normalizeLessonTypeLabel(lessonTypes);
  return lessonTypes
    .map((type) => normalizeLessonTypeLabel([type]))
    .map((type) => type.charAt(0).toUpperCase() + type.slice(1))
    .join(" · ");
};

const buildPerLessonLabel = (total: number | string, count?: number | null) => {
  if (!count || count <= 0) return undefined;
  const formattedTotal = formatCurrency(total);
  const numericTotal = typeof total === "string" ? Number.parseFloat(total) : total;
  if (!Number.isFinite(numericTotal)) {
    return formattedTotal ? `${formattedTotal} total` : undefined;
  }
  const per = numericTotal / count;
  const perLabel = formatCurrency(per) ?? per.toFixed(2);
  return `${perLabel} per lesson`;
};

const buildValidityLabel = (months?: number | null) => {
  if (months === null || months === undefined) return "Flexible expiry";
  if (months <= 0) return "No expiry";
  return `${months} month${months === 1 ? "" : "s"} validity`;
};

const formatDateLabel = (value?: string | null) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const extractPaymentMethods = (payload: PaymentMethodPayload): PlayerStripePaymentMethod[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.payment_methods)) return payload.payment_methods;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.paymentMethods)) return payload.paymentMethods;
  return [];
};

const resolveDefaultPaymentMethodId = (
  payload: PaymentMethodPayload,
  methods: PlayerStripePaymentMethod[],
) => {
  if (payload && !Array.isArray(payload)) {
    const candidate =
      payload.default_payment_method_id ||
      payload.default_payment_method ||
      (typeof payload.defaultPaymentMethodId === "string" ? payload.defaultPaymentMethodId : undefined);
    if (candidate) {
      return candidate;
    }
  }

  return (
    methods.find((method) => method.is_default || method.default || method.default_for_currency)?.id ??
    methods[0]?.id ??
    null
  );
};

const formatPaymentMethodLabel = (method: PlayerStripePaymentMethod) => {
  const brand =
    method.card?.brand ??
    (method as unknown as { brand?: string }).brand ??
    (method as unknown as { paymentMethod?: string }).paymentMethod ??
    "Card";
  const last4 = method.card?.last4 ?? (method as unknown as { last4?: string }).last4 ?? "";
  if (last4) {
    return `${brand} ending in ${last4}`;
  }
  return brand || method.id;
};

const buildPurchaseErrorMessage = (code?: string, fallback?: string) => {
  switch (code) {
    case "invalid_package_id":
    case "package_not_found":
      return "That package could not be found. Please select another option.";
    case "cannot_purchase_own_package":
      return "Coaches cannot purchase their own packages.";
    case "invalid_package_configuration":
      return "This package is not available right now. Please choose another.";
    case "payment_method_required":
      return "Select or add a payment method to continue.";
    case "player_missing_stripe_customer":
      return "We could not find your Stripe customer profile. Please add a payment method in settings and try again.";
    case "coach_missing_stripe_account":
      return "This coach is not ready to accept payments yet.";
    case "StripeCardError":
      return fallback || "Your card was declined. Try another payment method.";
    case "failed_to_purchase_package":
      return fallback || "We could not complete the purchase. Please try again.";
    default:
      return fallback || "Unable to complete this purchase. Please try again.";
  }
};

const PurchaseLessonPackageExperience = ({
  coach,
  onClose,
  presentation = "modal",
}: PurchaseLessonPackageExperienceProps) => {
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
  const [packages, setPackages] = useState<CoachPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [credits, setCredits] = useState<PackagePurchase[]>([]);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [creditsError, setCreditsError] = useState<string | null>(null);
  const [includeExpired, setIncludeExpired] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PlayerStripePaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [customPaymentMethodId, setCustomPaymentMethodId] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [purchaseState, setPurchaseState] = useState<PurchaseState>("idle");
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [processingPurchase, setProcessingPurchase] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    if (!coach?.id || !authToken) {
      setPackages([]);
      setPackagesError(authToken ? "Missing coach information." : "Sign in to view packages.");
      setPackagesLoading(false);
      return () => controller.abort();
    }

    setPackagesLoading(true);
    setPackagesError(null);

    fetchCoachPackages({
      token: authToken,
      coachId: coach.id,
      signal: controller.signal,
    })
      .then((data) => {
        const active = (data?.packages ?? []).filter((pkg) => pkg.is_active !== false);
        setPackages(active);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setPackages([]);
        setPackagesError(err instanceof Error ? err.message : "Unable to load packages.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setPackagesLoading(false);
        }
      });

    return () => controller.abort();
  }, [authToken, coach?.id]);

  const refreshCredits = async () => {
    if (!coach?.id || !authToken) {
      setCredits([]);
      setCreditsError(authToken ? "Missing coach information." : "Sign in to view credits.");
      setCreditsLoading(false);
      return;
    }

    setCreditsLoading(true);
    setCreditsError(null);

    try {
      const data = await fetchPackageCredits({
        token: authToken,
        coachId: coach.id,
        includeExpired,
      });
      setCredits(data?.purchases ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load credits.";
      setCreditsError(message);
      setCredits([]);
    } finally {
      setCreditsLoading(false);
    }
  };

  useEffect(() => {
    void refreshCredits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, coach?.id, includeExpired]);

  const loadPaymentMethods = async () => {
    if (!authToken) {
      setPaymentMethods([]);
      setPaymentMethodsError("Sign in to choose a payment method.");
      setPaymentMethodsLoading(false);
      return;
    }

    setPaymentMethodsLoading(true);
    setPaymentMethodsError(null);

    try {
      const payload = (await getPlayerStripePaymentMethods(authToken)) as PaymentMethodPayload;
      const methods = extractPaymentMethods(payload);
      setPaymentMethods(methods);
      const defaultId = resolveDefaultPaymentMethodId(payload, methods);
      setSelectedPaymentMethodId((prev) => prev ?? defaultId ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load payment methods.";
      setPaymentMethods([]);
      setPaymentMethodsError(message);
    } finally {
      setPaymentMethodsLoading(false);
    }
  };

  useEffect(() => {
    void loadPaymentMethods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  useEffect(() => {
    if (packages.length && !selectedPackageId) {
      setSelectedPackageId(String(packages[0].id));
    }
  }, [packages, selectedPackageId]);

  useEffect(() => {
    setPurchaseState("idle");
    setPurchaseError(null);
    setCustomPaymentMethodId("");
    setSelectedPaymentMethodId(null);
    setPaymentMethodsError(null);
  }, [coach?.id]);

  const selectedPackage = useMemo(
    () => packages.find((pkg) => String(pkg.id) === selectedPackageId) ?? null,
    [packages, selectedPackageId],
  );

  const creditEntries = useMemo(() => {
    const now = new Date();
    return credits.map((purchase) => {
      const displayLessonType = formatLessonTypeList(purchase.lesson_types_allowed);
      const remaining = purchase.credits_remaining ?? 0;
      const total =
        purchase.credits_total ?? remaining + (purchase.credits_used ?? 0);
      const expiresLabel = formatDateLabel(purchase.expires_at);
      const expired =
        purchase.expires_at && !Number.isNaN(new Date(purchase.expires_at).getTime())
          ? new Date(purchase.expires_at) < now
          : false;
      const purchasedLabel = formatDateLabel(purchase.purchased_at);
      return {
        id: String(purchase.id ?? `${displayLessonType}-${purchase.coach_package_id ?? "pkg"}`),
        lessonTypeLabel: displayLessonType,
        remaining,
        total,
        expiresLabel,
        expired,
        status: purchase.status,
        purchasedLabel,
      };
    });
  }, [credits]);

  const isModal = presentation === "modal";
  const modalTitleId = `purchase-package-modal-title-${coach.id}`;
  const dismissLabel = isModal ? "Close purchase dialog" : "Back to coach";
  const coachFirstName = (coach.name ?? coach.fullName ?? coach.headlineBadge ?? "Coach").split(" ")[0];
  const paymentMethodId = customPaymentMethodId.trim() || (selectedPaymentMethodId ?? "").trim();

  const handleDismiss = () => {
    if (onClose) {
      onClose();
    }
  };

  const handlePurchase = async () => {
    if (!authToken) {
      setPurchaseError("Sign in to purchase this package.");
      return;
    }
    if (!selectedPackage) {
      setPurchaseError("Select a package to continue.");
      return;
    }
    if (!paymentMethodId) {
      setPaymentMethodsError("Choose or enter a payment method to continue.");
      return;
    }

    setProcessingPurchase(true);
    setPurchaseError(null);
    setPurchaseState("processing");

    try {
      await purchaseCoachPackage({
        token: authToken,
        packageId: selectedPackage.id,
        paymentMethodId,
      });
      setPurchaseState("success");
      await refreshCredits();
    } catch (err) {
      const data = (err as Error & { data?: { error?: string; message?: string } }).data;
      const message = buildPurchaseErrorMessage(
        data?.error as string | undefined,
        data?.message ?? (err instanceof Error ? err.message : undefined),
      );
      setPurchaseError(message);
      setPurchaseState("idle");
    } finally {
      setProcessingPurchase(false);
    }
  };

  const purchaseContent = (
    <div
      className={`purchase-package-experience${isModal ? "" : " purchase-package-experience--page"}`}
      role={isModal ? "document" : "region"}
      aria-labelledby={modalTitleId}
    >
      <header className="purchase-package-experience__header">
        <div className="purchase-package-experience__intro">
          <span className="purchase-package-experience__eyebrow">Coach packages</span>
          <h2 className="purchase-package-experience__title" id={modalTitleId}>
            Purchase lesson credits
          </h2>
          {selectedPackage ? (
            <p className="purchase-package-experience__subtitle">
              Secure {selectedPackage.lesson_count} credits with {coachFirstName} and book faster.
            </p>
          ) : (
            <p className="purchase-package-experience__subtitle">
              Choose a package to save on lessons with {coachFirstName}.
            </p>
          )}
        </div>
        <button
          type="button"
          className={`purchase-package-experience__dismiss${
            isModal ? "" : " purchase-package-experience__dismiss--page"
          }`}
          onClick={handleDismiss}
          aria-label={dismissLabel}
        >
          {isModal ? <X aria-hidden /> : <ArrowLeft aria-hidden />}
          {!isModal ? <span>Back</span> : null}
        </button>
      </header>

      <div className="purchase-package-experience__body">
        {purchaseState === "success" ? (
          <div className="purchase-package-experience__success" role="status" aria-live="polite">
            <CheckCircle2 className="purchase-package-experience__success-icon" aria-hidden />
            <h3 className="purchase-package-experience__success-title">Package added</h3>
            <p className="purchase-package-experience__success-copy">
              Your credits are ready to use with {coachFirstName}. We&apos;ll email a confirmation receipt.
            </p>
            <button type="button" className="purchase-package-experience__primary" onClick={handleDismiss}>
              Close
            </button>
          </div>
        ) : (
          <div className="purchase-package-experience__layout">
            <section className="purchase-package-experience__primary-panel">
              <section className="purchase-package-experience__section">
                <div className="purchase-package-experience__section-header">
                  <span className="purchase-package-experience__section-eyebrow">Pick your package</span>
                  <p className="purchase-package-experience__section-copy">
                    See available bundles from this coach. Prices include all fees.
                  </p>
                </div>
                {packagesError ? (
                  <div className="purchase-package-experience__empty">
                    <AlertCircle aria-hidden /> {packagesError}
                  </div>
                ) : packagesLoading ? (
                  <div className="purchase-package-experience__empty">
                    <Loader2 className="purchase-package-page__spinner" aria-hidden />
                    Loading packages…
                  </div>
                ) : packages.length > 0 ? (
                  <div className="purchase-package-experience__packages">
                    {packages.map((lessonPackage) => {
                      const isSelected = String(lessonPackage.id) === selectedPackageId;
                      const perLessonLabel = buildPerLessonLabel(
                        lessonPackage.total_price,
                        lessonPackage.lesson_count,
                      );
                      const totalPriceLabel =
                        formatCurrency(lessonPackage.total_price) ??
                        (typeof lessonPackage.total_price === "string"
                          ? lessonPackage.total_price
                          : `${lessonPackage.total_price}`);
                      const validityLabel = buildValidityLabel(lessonPackage.validity_months);
                      const lessonTypeLabel = formatLessonTypeList(lessonPackage.lesson_types_allowed);
                      const packageTitle =
                        lessonPackage.name || `${lessonPackage.lesson_count} ${lessonTypeLabel} package`;

                      return (
                        <label
                          key={lessonPackage.id}
                          className={`purchase-package-experience__package${
                            isSelected ? " purchase-package-experience__package--selected" : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="lesson-package"
                            value={lessonPackage.id}
                            checked={isSelected}
                            onChange={() => setSelectedPackageId(String(lessonPackage.id))}
                          />
                          <div className="purchase-package-experience__package-top">
                            <div className="purchase-package-experience__package-badge">
                              <Package aria-hidden />
                              <span>{lessonTypeLabel}</span>
                            </div>
                            <span className="purchase-package-experience__package-lessons">
                              {lessonPackage.lesson_count} credits
                            </span>
                          </div>
                          <p className="purchase-package-experience__package-title">{packageTitle}</p>
                          <p className="purchase-package-experience__package-description">
                            {lessonPackage.description || "Flexible credit bundle for this coach."}
                          </p>
                          <div className="purchase-package-experience__package-pricing">
                            <span className="purchase-package-experience__package-total">{totalPriceLabel}</span>
                            <span className="purchase-package-experience__package-per">
                              {perLessonLabel ?? validityLabel}
                            </span>
                          </div>
                          <span className="purchase-package-experience__package-meta">{validityLabel}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="purchase-package-experience__empty">No packages are available right now.</div>
                )}
              </section>
            </section>

            <aside className="purchase-package-experience__aside">
              <div className="purchase-package-experience__summary-card">
                <Wallet className="purchase-package-experience__summary-icon" aria-hidden />
                <div className="purchase-package-experience__summary-body">
                  <span className="purchase-package-experience__summary-eyebrow">Credits</span>
                  {creditsLoading ? (
                    <p className="purchase-package-experience__summary-copy">Loading your credits…</p>
                  ) : creditsError ? (
                    <p className="purchase-package-experience__summary-copy">{creditsError}</p>
                  ) : creditEntries.length > 0 ? (
                    <ul className="coach-profile-packages__status-list">
                      {creditEntries.map((credit) => (
                        <li
                          key={credit.id}
                          className={`coach-profile-packages__status-item${
                            credit.expired ? "" : " coach-profile-packages__status-item--active"
                          }`}
                        >
                          <div className="coach-profile-packages__status-item-main">
                            <span className="coach-profile-packages__status-type">{credit.lessonTypeLabel}</span>
                            <span className="coach-profile-packages__status-remaining">
                              {credit.remaining} of {credit.total} left
                            </span>
                          </div>
                          <span className="coach-profile-packages__status-meta">
                            {credit.expiresLabel
                              ? credit.expired
                                ? `Expired ${credit.expiresLabel}`
                                : `Expires ${credit.expiresLabel}`
                              : "No expiry date provided"}
                          </span>
                          {credit.status ? (
                            <span className="coach-profile-packages__status-meta">{credit.status}</span>
                          ) : null}
                          {credit.purchasedLabel ? (
                            <span className="coach-profile-packages__status-meta">
                              Purchased {credit.purchasedLabel}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="purchase-package-experience__summary-copy">
                      You don&apos;t have any credits saved for this coach yet.
                    </p>
                  )}
                  <label className="coach-profile-packages__status-meta">
                    <input
                      type="checkbox"
                      checked={includeExpired}
                      onChange={(event) => setIncludeExpired(event.target.checked)}
                    />{" "}
                    Include expired or fully used credits
                  </label>
                </div>
              </div>

              {selectedPackage ? (
                <div className="purchase-package-experience__order-card">
                  <div className="purchase-package-experience__order-header">
                    <h3>Order summary</h3>
                    <span>{formatCurrency(selectedPackage.total_price) ?? selectedPackage.total_price}</span>
                  </div>
                  <div className="purchase-package-experience__order-line">
                    <span>{selectedPackage.name ?? `${selectedPackage.lesson_count} credits`}</span>
                    <span>{buildValidityLabel(selectedPackage.validity_months)}</span>
                  </div>
                  <p className="purchase-package-experience__order-copy">
                    Includes {selectedPackage.lesson_count} credits with {coachFirstName}. Credits apply to{" "}
                    {formatLessonTypeList(selectedPackage.lesson_types_allowed)} lessons.
                  </p>
                  <div className="purchase-package-experience__summary-highlight">
                    <Package aria-hidden />
                    <span>{buildPerLessonLabel(selectedPackage.total_price, selectedPackage.lesson_count)}</span>
                  </div>
                </div>
              ) : null}

              <div className="purchase-package-experience__payment-card">
                <div className="purchase-package-experience__payment-header">
                  <div>
                    <h3>Payment method</h3>
                    <p>Choose how you&apos;d like to take care of this package.</p>
                  </div>
                  <span className="purchase-package-experience__payment-secure">
                    <ShieldCheck aria-hidden size={16} /> Secure checkout
                  </span>
                </div>

                <div className="payment-methods">
                  {paymentMethodsError ? (
                    <div className="purchase-package-experience__empty" role="alert">
                      <AlertCircle aria-hidden /> {paymentMethodsError}
                    </div>
                  ) : null}
                  {paymentMethodsLoading ? (
                    <div className="purchase-package-experience__empty">
                      <Loader2 className="purchase-package-page__spinner" aria-hidden /> Loading payment methods…
                    </div>
                  ) : paymentMethods.length > 0 ? (
                    <div className="payment-methods__group">
                      <span className="payment-methods__group-label">Saved cards</span>
                      <div className="payment-methods__stack">
                        {paymentMethods.map((method) => {
                          const isSelected = selectedPaymentMethodId === method.id;
                          return (
                            <label
                              key={method.id}
                              className={`payment-method-card${isSelected ? " payment-method-card--selected" : ""}`}
                            >
                              <input
                                type="radio"
                                name="payment-method"
                                value={method.id}
                                checked={isSelected}
                                onChange={() => {
                                  setPaymentMethodsError(null);
                                  setSelectedPaymentMethodId(method.id);
                                }}
                              />
                              <span className="payment-method-card__selector" aria-hidden />
                              <span className="payment-method-card__icon">
                                <CreditCard aria-hidden />
                              </span>
                              <span className="payment-method-card__body">
                                <span className="payment-method-card__title">{formatPaymentMethodLabel(method)}</span>
                                <span className="payment-method-card__subtitle">
                                  {method.card?.exp_month && method.card?.exp_year
                                    ? `Expires ${String(method.card.exp_month).padStart(2, "0")}/${String(
                                        method.card.exp_year,
                                      ).slice(-2)}`
                                    : "Saved payment method"}
                                </span>
                              </span>
                              {method.is_default || method.default || method.default_for_currency ? (
                                <span className="payment-method-card__tag">Default</span>
                              ) : null}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="purchase-package-experience__empty">
                      No saved payment methods. Add one in settings or paste a Stripe payment method ID below.
                    </div>
                  )}

                  {/* <div className="payment-methods__group">
                    <span className="payment-methods__group-label">Use a payment method ID</span>
                    <div className="payment-method-card payment-method-card--new payment-method-card--selected">
                      <span className="payment-method-card__icon">
                        <CreditCard aria-hidden />
                      </span>
                      <span className="payment-method-card__body">
                        <span className="payment-method-card__title">Enter a payment method ID</span>
                        <span className="payment-method-card__subtitle">
                          Paste a Stripe `pm_` ID to charge that payment method.
                        </span>
                      </span>
                      <div className="payment-method-card__form" role="group" aria-label="Payment method ID">
                        <label className="payment-method-card__form-field">
                          <span>Payment method ID</span>
                          <input
                            name="payment_method_id"
                            type="text"
                            placeholder="pm_xxx"
                            value={customPaymentMethodId}
                            onChange={(event) => {
                              setPaymentMethodsError(null);
                              setCustomPaymentMethodId(event.target.value);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div> */}
                </div>

                {purchaseError ? (
                  <div className="purchase-package-experience__empty" role="alert">
                    <AlertCircle aria-hidden /> {purchaseError}
                  </div>
                ) : null}

                {selectedPackage ? (
                  <button
                    type="button"
                    className="purchase-package-experience__primary purchase-package-experience__primary--full"
                    onClick={handlePurchase}
                    disabled={processingPurchase}
                  >
                    {processingPurchase ? (
                      <>
                        <Loader2 className="purchase-package-page__spinner" aria-hidden /> Processing…
                      </>
                    ) : (
                      <>Complete purchase · {formatCurrency(selectedPackage.total_price) ?? selectedPackage.total_price}</>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="purchase-package-experience__primary purchase-package-experience__primary--full"
                    disabled
                  >
                    Choose a package to continue
                  </button>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="purchase-package-modal-overlay" role="dialog" aria-modal aria-labelledby={modalTitleId}>
        {purchaseContent}
        <button
          type="button"
          className="purchase-package-modal-overlay__backdrop"
          aria-hidden="true"
          onClick={handleDismiss}
        />
      </div>
    );
  }

  return (
    <div className="purchase-package-page" aria-labelledby={modalTitleId}>
      {purchaseContent}
    </div>
  );
};

export const PurchaseLessonPackageModal = ({ coach, onClose }: { coach: CoachProfileRecord; onClose: () => void }) => (
  <PurchaseLessonPackageExperience coach={coach} onClose={onClose} presentation="modal" />
);

export const PurchaseLessonPackageCheckout = ({
  coach,
  onClose,
}: {
  coach: CoachProfileRecord;
  onClose?: () => void;
}) => <PurchaseLessonPackageExperience coach={coach} onClose={onClose} presentation="page" />;

export default PurchaseLessonPackageExperience;
