import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  Apple,
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  Package,
  ShieldCheck,
  TicketPercent,
  Wallet,
  X,
} from "lucide-react";

import type { CoachProfile } from "../../data/mockCoachProfiles";

import "./PurchaseLessonPackageExperience.css";

type PurchaseLessonPackagePresentation = "modal" | "page";

type PurchaseLessonPackageExperienceProps = {
  coach: CoachProfile;
  onClose?: () => void;
  presentation?: PurchaseLessonPackagePresentation;
};

type PurchaseState = "selecting" | "confirmed";

type SavedCard = {
  id: string;
  brand: string;
  last4: string;
  expiry: string;
  nickname?: string;
  isDefault?: boolean;
};

type NewCardFormState = {
  name: string;
  number: string;
  expiry: string;
  cvc: string;
  postalCode: string;
};

const savedPaymentMethods: SavedCard[] = [
  { id: "card-personal", brand: "Visa", last4: "4242", expiry: "04/26", nickname: "Personal", isDefault: true },
  { id: "card-training", brand: "Mastercard", last4: "1188", expiry: "11/25", nickname: "Club expenses" },
];

const initialNewCardForm: NewCardFormState = {
  name: "",
  number: "",
  expiry: "",
  cvc: "",
  postalCode: "",
};

const buildLessonTypeLabel = (count: number, label?: string) => {
  if (!label) {
    return `${count} lesson${count === 1 ? "" : "s"}`;
  }

  const normalized = label.toLowerCase();
  return `${count} ${normalized}`;
};

const normalizeUnit = (unit?: string) => unit?.replace("/", "").trim() || "lesson";

const PurchaseLessonPackageExperience = ({
  coach,
  onClose,
  presentation = "modal",
}: PurchaseLessonPackageExperienceProps) => {
  const packages = coach.lessonPackages ?? [];
  const lessonTypes = coach.booking.lessonTypes;
  const coachFirstName = coach.name.split(" ")[0] ?? coach.name;

  const [selectedLessonTypeId, setSelectedLessonTypeId] = useState(coach.booking.defaultLessonType);
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [purchaseState, setPurchaseState] = useState<PurchaseState>("selecting");
  const [paymentMethod, setPaymentMethod] = useState<string>(savedPaymentMethods[0]?.id ?? "apple-pay");
  const [newCardForm, setNewCardForm] = useState<NewCardFormState>(initialNewCardForm);

  useEffect(() => {
    setSelectedLessonTypeId(coach.booking.defaultLessonType);
    setPurchaseState("selecting");
    setPaymentMethod(savedPaymentMethods[0]?.id ?? "apple-pay");
    setNewCardForm(initialNewCardForm);
  }, [coach]);

  const selectedLessonType = useMemo(
    () => lessonTypes.find((type) => type.id === selectedLessonTypeId) ?? lessonTypes[0],
    [lessonTypes, selectedLessonTypeId],
  );

  const packagesForLessonType = useMemo(
    () => packages.filter((pkg) => pkg.lessonTypeId === selectedLessonType?.id),
    [packages, selectedLessonType?.id],
  );

  useEffect(() => {
    setSelectedPackageId(packagesForLessonType[0]?.id ?? "");
  }, [packagesForLessonType]);

  const selectedPackage = useMemo(
    () => packagesForLessonType.find((pkg) => pkg.id === selectedPackageId) ?? packagesForLessonType[0],
    [packagesForLessonType, selectedPackageId],
  );

  const creditsForLessonType = useMemo(() => {
    return coach.playerLessonCredits?.find((credit) => credit.lessonTypeId === selectedLessonType?.id);
  }, [coach.playerLessonCredits, selectedLessonType?.id]);

  const isUsingNewCard = paymentMethod === "new-card";
  const isUsingApplePay = paymentMethod === "apple-pay";

  const handleConfirmPurchase = () => {
    if (!selectedPackage) {
      return;
    }

    setPurchaseState("confirmed");
  };

  const handleDismiss = () => {
    if (onClose) {
      onClose();
    }
  };

  const handleNewCardChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setNewCardForm((prev) => ({ ...prev, [name]: value }));
  };

  const modalTitleId = `purchase-package-modal-title-${coach.id}`;
  const lessonTypeToggleId = `purchase-package-lesson-toggle-${coach.id}`;
  const isModal = presentation === "modal";

  const dismissLabel = isModal ? "Close purchase dialog" : "Back to coach";
  const baseRateLabel = selectedLessonType ? `${selectedLessonType.price}${selectedLessonType.unit}` : undefined;

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
              Lock in {selectedPackage.discount.toLowerCase()} when you reserve {buildLessonTypeLabel(
                selectedPackage.lessons,
                selectedLessonType?.label,
              )} with {coachFirstName}.
            </p>
          ) : (
            <p className="purchase-package-experience__subtitle">
              Choose a lesson format to explore bundle options with {coachFirstName}.
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
        {purchaseState === "confirmed" && selectedPackage ? (
          <div className="purchase-package-experience__success" role="status" aria-live="polite">
            <CheckCircle2 className="purchase-package-experience__success-icon" aria-hidden />
            <h3 className="purchase-package-experience__success-title">Package added</h3>
            <p className="purchase-package-experience__success-copy">
              {buildLessonTypeLabel(selectedPackage.lessons, selectedLessonType?.label)} are ready to book. We&apos;ll email a
              confirmation receipt.
            </p>
            <button type="button" className="purchase-package-experience__primary" onClick={handleDismiss}>
              Close
            </button>
          </div>
        ) : (
          <div className="purchase-package-experience__layout">
            <section className="purchase-package-experience__primary-panel">
              {lessonTypes.length > 1 ? (
                <section className="purchase-package-experience__section" aria-labelledby={lessonTypeToggleId}>
                  <div className="purchase-package-experience__section-header">
                    <span className="purchase-package-experience__section-eyebrow" id={lessonTypeToggleId}>
                      Choose lesson format
                    </span>
                    <p className="purchase-package-experience__section-copy">
                      Credits apply to the lesson type you select below.
                    </p>
                  </div>
                  <div className="purchase-package-experience__toggle">
                    {lessonTypes.map((lessonType) => {
                      const active = lessonType.id === selectedLessonTypeId;
                      return (
                        <button
                          key={lessonType.id}
                          type="button"
                          className={`purchase-package-experience__toggle-pill${
                            active ? " purchase-package-experience__toggle-pill--active" : ""
                          }`}
                          aria-pressed={active}
                          onClick={() => setSelectedLessonTypeId(lessonType.id)}
                        >
                          <span className="purchase-package-experience__toggle-title">{lessonType.label}</span>
                          <span className="purchase-package-experience__toggle-price">{lessonType.price}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {selectedLessonType ? (
                <section className="purchase-package-experience__lesson-overview">
                  <div className="purchase-package-experience__lesson-overview-header">
                    <span className="purchase-package-experience__lesson-eyebrow">{selectedLessonType.description}</span>
                    <h3>{selectedLessonType.tagline}</h3>
                    <p>{selectedLessonType.duration}</p>
                  </div>
                  <div className="purchase-package-experience__lesson-overview-meta">
                    <div>
                      <span className="purchase-package-experience__lesson-meta-label">Rate</span>
                      <span className="purchase-package-experience__lesson-meta-value">
                        {selectedLessonType.price}
                        <span className="purchase-package-experience__lesson-meta-unit">{selectedLessonType.unit}</span>
                      </span>
                    </div>
                    <div>
                      <span className="purchase-package-experience__lesson-meta-label">Format</span>
                      <span className="purchase-package-experience__lesson-meta-value">
                        {selectedLessonType.duration.split("•")[1]?.trim() ?? "Single player"}
                      </span>
                    </div>
                  </div>
                  {selectedLessonType.bullets?.length ? (
                    <ul className="purchase-package-experience__lesson-bullets">
                      {selectedLessonType.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : null}

              <section className="purchase-package-experience__section">
                <div className="purchase-package-experience__section-header">
                  <span className="purchase-package-experience__section-eyebrow">Pick your package</span>
                  <p className="purchase-package-experience__section-copy">
                    Save more when you bundle lessons up front.
                  </p>
                </div>
                {packagesForLessonType.length > 0 ? (
                  <div className="purchase-package-experience__packages">
                    {packagesForLessonType.map((lessonPackage) => {
                      const isSelected = lessonPackage.id === selectedPackage?.id;
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
                            onChange={() => setSelectedPackageId(lessonPackage.id)}
                          />
                          <div className="purchase-package-experience__package-top">
                            <div className="purchase-package-experience__package-badge">
                              <TicketPercent aria-hidden />
                              <span>{lessonPackage.discount}</span>
                            </div>
                            <span className="purchase-package-experience__package-lessons">
                              {lessonPackage.lessons} credits
                            </span>
                          </div>
                          <p className="purchase-package-experience__package-title">{lessonPackage.title}</p>
                          <p className="purchase-package-experience__package-description">{lessonPackage.description}</p>
                          <div className="purchase-package-experience__package-pricing">
                            <span className="purchase-package-experience__package-total">{lessonPackage.totalPrice}</span>
                            <span className="purchase-package-experience__package-per">{lessonPackage.pricePerLesson}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="purchase-package-experience__empty">Packages coming soon for this lesson type.</div>
                )}
              </section>
            </section>

            <aside className="purchase-package-experience__aside">
              <div className="purchase-package-experience__summary-card">
                <Wallet className="purchase-package-experience__summary-icon" aria-hidden />
                <div className="purchase-package-experience__summary-body">
                  <span className="purchase-package-experience__summary-eyebrow">Current credits</span>
                  <p className="purchase-package-experience__summary-copy">
                    {creditsForLessonType ? (
                      <>
                        {creditsForLessonType.remaining} of {creditsForLessonType.totalPurchased ?? creditsForLessonType.remaining}{" "}
                        credits left for {selectedLessonType?.label?.toLowerCase()}.
                      </>
                    ) : (
                      <>You don&apos;t have any credits saved for {selectedLessonType?.label?.toLowerCase()} yet.</>
                    )}
                  </p>
                  {creditsForLessonType?.upcomingExpiryLabel ? (
                    <span className="purchase-package-experience__summary-meta">
                      <Clock aria-hidden />
                      {creditsForLessonType.upcomingExpiryLabel}
                    </span>
                  ) : null}
                  {creditsForLessonType?.lastPurchasedLabel ? (
                    <span className="purchase-package-experience__summary-meta">
                      <ShieldCheck aria-hidden />
                      {creditsForLessonType.lastPurchasedLabel}
                    </span>
                  ) : null}
                </div>
              </div>

              {selectedPackage ? (
                <div className="purchase-package-experience__order-card">
                  <div className="purchase-package-experience__order-header">
                    <h3>Order summary</h3>
                    <span>{selectedPackage.totalPrice}</span>
                  </div>
                  <div className="purchase-package-experience__order-line">
                    <span>{selectedPackage.title}</span>
                    <span>{selectedPackage.discount}</span>
                  </div>
                  <p className="purchase-package-experience__order-copy">
                    Includes {buildLessonTypeLabel(selectedPackage.lessons, selectedLessonType?.label)} with {coachFirstName}.
                  </p>
                  {baseRateLabel ? (
                    <div className="purchase-package-experience__summary-highlight">
                      <Package aria-hidden />
                      <span>
                        {selectedPackage.discount} vs. paying {baseRateLabel} per {normalizeUnit(selectedLessonType?.unit)}.
                      </span>
                    </div>
                  ) : null}
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
                  <div className="payment-methods__group">
                    <span className="payment-methods__group-label">Saved cards</span>
                    <div className="payment-methods__stack">
                      {savedPaymentMethods.map((card) => {
                        const isSelected = paymentMethod === card.id;
                        return (
                          <label
                            key={card.id}
                            className={`payment-method-card${isSelected ? " payment-method-card--selected" : ""}`}
                          >
                            <input
                              type="radio"
                              name="payment-method"
                              value={card.id}
                              checked={isSelected}
                              onChange={() => setPaymentMethod(card.id)}
                            />
                            <span className="payment-method-card__selector" aria-hidden />
                            <span className="payment-method-card__icon">
                              <CreditCard aria-hidden />
                            </span>
                            <span className="payment-method-card__body">
                              <span className="payment-method-card__title">
                                {card.brand} ending in {card.last4}
                              </span>
                              <span className="payment-method-card__subtitle">
                                Expires {card.expiry}
                                {card.nickname ? ` • ${card.nickname}` : ""}
                              </span>
                            </span>
                            {card.isDefault ? <span className="payment-method-card__tag">Default</span> : null}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <label
                    className={`payment-method-card payment-method-card--new${
                      isUsingNewCard ? " payment-method-card--selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      value="new-card"
                      checked={isUsingNewCard}
                      onChange={() => setPaymentMethod("new-card")}
                    />
                    <span className="payment-method-card__selector" aria-hidden />
                    <span className="payment-method-card__icon">
                      <CreditCard aria-hidden />
                    </span>
                    <span className="payment-method-card__body">
                      <span className="payment-method-card__title">Add a new credit card</span>
                      <span className="payment-method-card__subtitle">Securely save it for future packages.</span>
                    </span>
                    <div className="payment-method-card__form" role="group" aria-label="New card details">
                      <div className="payment-method-card__form-row">
                        <label className="payment-method-card__form-field">
                          <span>Cardholder name</span>
                          <input
                            name="name"
                            type="text"
                            autoComplete="cc-name"
                            value={newCardForm.name}
                            onChange={handleNewCardChange}
                            disabled={!isUsingNewCard}
                          />
                        </label>
                      </div>
                      <div className="payment-method-card__form-row">
                        <label className="payment-method-card__form-field">
                          <span>Card number</span>
                          <input
                            name="number"
                            type="text"
                            inputMode="numeric"
                            autoComplete="cc-number"
                            value={newCardForm.number}
                            onChange={handleNewCardChange}
                            disabled={!isUsingNewCard}
                          />
                        </label>
                      </div>
                      <div className="payment-method-card__form-row payment-method-card__form-row--split">
                        <label className="payment-method-card__form-field">
                          <span>Expiry</span>
                          <input
                            name="expiry"
                            type="text"
                            placeholder="MM/YY"
                            autoComplete="cc-exp"
                            value={newCardForm.expiry}
                            onChange={handleNewCardChange}
                            disabled={!isUsingNewCard}
                          />
                        </label>
                        <label className="payment-method-card__form-field">
                          <span>CVC</span>
                          <input
                            name="cvc"
                            type="text"
                            inputMode="numeric"
                            autoComplete="cc-csc"
                            value={newCardForm.cvc}
                            onChange={handleNewCardChange}
                            disabled={!isUsingNewCard}
                          />
                        </label>
                      </div>
                      <div className="payment-method-card__form-row">
                        <label className="payment-method-card__form-field">
                          <span>Billing ZIP</span>
                          <input
                            name="postalCode"
                            type="text"
                            inputMode="numeric"
                            autoComplete="postal-code"
                            value={newCardForm.postalCode}
                            onChange={handleNewCardChange}
                            disabled={!isUsingNewCard}
                          />
                        </label>
                      </div>
                    </div>
                  </label>

                  <div className="payment-methods__group">
                    <span className="payment-methods__group-label">Digital wallet</span>
                    <label
                      className={`payment-method-card payment-method-card--wallet${
                        isUsingApplePay ? " payment-method-card--selected" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment-method"
                        value="apple-pay"
                        checked={isUsingApplePay}
                        onChange={() => setPaymentMethod("apple-pay")}
                      />
                      <span className="payment-method-card__selector" aria-hidden />
                      <span className="payment-method-card__icon">
                        <Apple aria-hidden />
                      </span>
                      <span className="payment-method-card__body">
                        <span className="payment-method-card__title">Apple Pay</span>
                        <span className="payment-method-card__subtitle">Pay instantly with your saved wallet.</span>
                      </span>
                    </label>
                  </div>
                </div>

                {selectedPackage ? (
                  <button
                    type="button"
                    className="purchase-package-experience__primary purchase-package-experience__primary--full"
                    onClick={handleConfirmPurchase}
                  >
                    Complete purchase · {selectedPackage.totalPrice}
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

export const PurchaseLessonPackageModal = ({ coach, onClose }: { coach: CoachProfile; onClose: () => void }) => (
  <PurchaseLessonPackageExperience coach={coach} onClose={onClose} presentation="modal" />
);

export const PurchaseLessonPackageCheckout = ({ coach, onClose }: { coach: CoachProfile; onClose?: () => void }) => (
  <PurchaseLessonPackageExperience coach={coach} onClose={onClose} presentation="page" />
);

export default PurchaseLessonPackageExperience;
