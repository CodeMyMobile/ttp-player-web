import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Package,
  ShieldCheck,
  TicketPercent,
  Wallet,
  X,
} from "lucide-react";

import type { CoachProfile } from "../../data/mockCoachProfiles";

import "./PurchaseLessonPackageModal.css";

type PurchaseLessonPackageModalProps = {
  coach: CoachProfile;
  onClose: () => void;
};

type PurchaseState = "selecting" | "confirmed";

const buildLessonTypeLabel = (count: number, label?: string) => {
  if (!label) {
    return `${count} lesson${count === 1 ? "" : "s"}`;
  }

  const normalized = label.toLowerCase();
  return `${count} ${normalized}`;
};

const PurchaseLessonPackageModal = ({ coach, onClose }: PurchaseLessonPackageModalProps) => {
  const packages = coach.lessonPackages ?? [];
  const lessonTypes = coach.booking.lessonTypes;
  const [selectedLessonTypeId, setSelectedLessonTypeId] = useState(coach.booking.defaultLessonType);
  const [selectedPackageId, setSelectedPackageId] = useState(packages[0]?.id ?? "");
  const [purchaseState, setPurchaseState] = useState<PurchaseState>("selecting");

  useEffect(() => {
    setSelectedLessonTypeId(coach.booking.defaultLessonType);
    setSelectedPackageId(packages[0]?.id ?? "");
    setPurchaseState("selecting");
  }, [coach, packages]);

  const selectedLessonType = useMemo(
    () => lessonTypes.find((type) => type.id === selectedLessonTypeId) ?? lessonTypes[0],
    [lessonTypes, selectedLessonTypeId],
  );

  const selectedPackage = useMemo(
    () => packages.find((pkg) => pkg.id === selectedPackageId) ?? packages[0],
    [packages, selectedPackageId],
  );

  const creditsForLessonType = useMemo(() => {
    return coach.playerLessonCredits?.find((credit) => credit.lessonTypeId === selectedLessonType?.id);
  }, [coach.playerLessonCredits, selectedLessonType?.id]);

  const handleConfirmPurchase = () => {
    if (!selectedPackage) {
      return;
    }

    setPurchaseState("confirmed");
  };

  const modalTitleId = `purchase-package-modal-title-${coach.id}`;
  const lessonTypeToggleId = `purchase-package-lesson-toggle-${coach.id}`;

  return (
    <div className="purchase-package-modal-overlay" role="dialog" aria-modal="true" aria-labelledby={modalTitleId}>
      <div className="purchase-package-modal" role="document">
        <header className="purchase-package-modal__header">
          <div className="purchase-package-modal__intro">
            <span className="purchase-package-modal__eyebrow">Coach packages</span>
            <h2 className="purchase-package-modal__title" id={modalTitleId}>
              Purchase lesson credits
            </h2>
            {selectedPackage ? (
              <p className="purchase-package-modal__subtitle">
                Lock in {selectedPackage.discount.toLowerCase()} when you reserve {buildLessonTypeLabel(
                  selectedPackage.lessons,
                  selectedLessonType?.label,
                )} with {coach.name.split(" ")[0]}.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="purchase-package-modal__close"
            onClick={onClose}
            aria-label="Close purchase dialog"
          >
            <X aria-hidden />
          </button>
        </header>

        <div className="purchase-package-modal__body">
          {purchaseState === "confirmed" && selectedPackage ? (
            <div className="purchase-package-modal__success" role="status" aria-live="polite">
              <CheckCircle2 className="purchase-package-modal__success-icon" aria-hidden />
              <h3 className="purchase-package-modal__success-title">Package added</h3>
              <p className="purchase-package-modal__success-copy">
                {buildLessonTypeLabel(selectedPackage.lessons, selectedLessonType?.label)} are ready to book.
                We&apos;ll email a confirmation receipt.
              </p>
              <button type="button" className="purchase-package-modal__primary" onClick={onClose}>
                Close
              </button>
            </div>
          ) : (
            <>
              {lessonTypes.length > 1 ? (
                <section className="purchase-package-modal__section" aria-labelledby={lessonTypeToggleId}>
                  <div className="purchase-package-modal__section-header">
                    <span className="purchase-package-modal__section-eyebrow" id={lessonTypeToggleId}>
                      Choose lesson format
                    </span>
                    <p className="purchase-package-modal__section-copy">
                      Credits apply to the lesson type you select below.
                    </p>
                  </div>
                  <div className="purchase-package-modal__toggle">
                    {lessonTypes.map((lessonType) => {
                      const active = lessonType.id === selectedLessonTypeId;
                      return (
                        <button
                          key={lessonType.id}
                          type="button"
                          className={`purchase-package-modal__toggle-pill${active ? " purchase-package-modal__toggle-pill--active" : ""}`}
                          aria-pressed={active}
                          onClick={() => setSelectedLessonTypeId(lessonType.id)}
                        >
                          <span className="purchase-package-modal__toggle-title">{lessonType.label}</span>
                          <span className="purchase-package-modal__toggle-price">{lessonType.price}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {packages.length > 0 ? (
                <section className="purchase-package-modal__section">
                  <div className="purchase-package-modal__section-header">
                    <span className="purchase-package-modal__section-eyebrow">Pick your package</span>
                    <p className="purchase-package-modal__section-copy">
                      Save more when you bundle lessons up front.
                    </p>
                  </div>
                  <div className="purchase-package-modal__packages">
                    {packages.map((lessonPackage) => {
                      const isSelected = lessonPackage.id === selectedPackage?.id;
                      return (
                        <label
                          key={lessonPackage.id}
                          className={`purchase-package-modal__package${
                            isSelected ? " purchase-package-modal__package--selected" : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="lesson-package"
                            value={lessonPackage.id}
                            checked={isSelected}
                            onChange={() => setSelectedPackageId(lessonPackage.id)}
                          />
                          <div className="purchase-package-modal__package-top">
                            <div className="purchase-package-modal__package-badge">
                              <TicketPercent aria-hidden />
                              <span>{lessonPackage.discount}</span>
                            </div>
                            <span className="purchase-package-modal__package-lessons">
                              {lessonPackage.lessons} credits
                            </span>
                          </div>
                          <p className="purchase-package-modal__package-title">{lessonPackage.title}</p>
                          <p className="purchase-package-modal__package-description">{lessonPackage.description}</p>
                          <div className="purchase-package-modal__package-pricing">
                            <span className="purchase-package-modal__package-total">{lessonPackage.totalPrice}</span>
                            <span className="purchase-package-modal__package-per">{lessonPackage.pricePerLesson}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              <section className="purchase-package-modal__section">
                <div className="purchase-package-modal__summary">
                  <div className="purchase-package-modal__summary-card">
                    <Wallet className="purchase-package-modal__summary-icon" aria-hidden />
                    <div className="purchase-package-modal__summary-body">
                      <span className="purchase-package-modal__summary-eyebrow">Current credits</span>
                      <p className="purchase-package-modal__summary-copy">
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
                        <span className="purchase-package-modal__summary-meta">
                          <Clock aria-hidden />
                          {creditsForLessonType.upcomingExpiryLabel}
                        </span>
                      ) : null}
                      {creditsForLessonType?.lastPurchasedLabel ? (
                        <span className="purchase-package-modal__summary-meta">
                          <ShieldCheck aria-hidden />
                          {creditsForLessonType.lastPurchasedLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {selectedPackage ? (
                    <div className="purchase-package-modal__summary-footer">
                      <div className="purchase-package-modal__summary-highlight">
                        <Package aria-hidden />
                        <span>
                          {selectedPackage.discount} vs. paying {selectedLessonType?.price} per {selectedLessonType?.unit.replace("/", "").trim() || "lesson"}.
                        </span>
                      </div>
                      <button type="button" className="purchase-package-modal__primary" onClick={handleConfirmPurchase}>
                        Confirm purchase · {selectedPackage.totalPrice}
                      </button>
                    </div>
                  ) : null}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        className="purchase-package-modal-overlay__backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
    </div>
  );
};

export default PurchaseLessonPackageModal;
