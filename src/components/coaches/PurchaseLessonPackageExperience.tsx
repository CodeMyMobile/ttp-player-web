import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
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

const buildLessonTypeLabel = (count: number, label?: string) => {
  if (!label) {
    return `${count} lesson${count === 1 ? "" : "s"}`;
  }

  const normalized = label.toLowerCase();
  return `${count} ${normalized}`;
};

const PurchaseLessonPackageExperience = ({
  coach,
  onClose,
  presentation = "modal",
}: PurchaseLessonPackageExperienceProps) => {
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
  const isModal = presentation === "modal";

  const dismissLabel = isModal ? "Close purchase dialog" : "Back to coach";

  const handleDismiss = () => {
    if (onClose) {
      onClose();
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
              Lock in {selectedPackage.discount.toLowerCase()} when you reserve {buildLessonTypeLabel(
                selectedPackage.lessons,
                selectedLessonType?.label,
              )} with {coach.name.split(" ")[0]}.
            </p>
          ) : null}
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
          <>
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

            {packages.length > 0 ? (
              <section className="purchase-package-experience__section">
                <div className="purchase-package-experience__section-header">
                  <span className="purchase-package-experience__section-eyebrow">Pick your package</span>
                  <p className="purchase-package-experience__section-copy">
                    Save more when you bundle lessons up front.
                  </p>
                </div>
                <div className="purchase-package-experience__packages">
                  {packages.map((lessonPackage) => {
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
              </section>
            ) : null}

            <section className="purchase-package-experience__section">
              <div className="purchase-package-experience__summary">
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
                  <div className="purchase-package-experience__summary-footer">
                    <div className="purchase-package-experience__summary-highlight">
                      <Package aria-hidden />
                      <span>
                        {selectedPackage.discount} vs. paying {selectedLessonType?.price} per {selectedLessonType?.unit.replace("/", "").trim() || "lesson"}.
                      </span>
                    </div>
                    <button type="button" className="purchase-package-experience__primary" onClick={handleConfirmPurchase}>
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
