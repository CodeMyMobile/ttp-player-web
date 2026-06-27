const parseStatusValue = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeActorId = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
};

export const isCancelledGroupLessonRecord = (lesson) => {
  if (!lesson || typeof lesson !== "object") return false;

  const createdBy = normalizeActorId(lesson.created_by);
  const updatedBy = normalizeActorId(lesson.updated_by);

  return parseStatusValue(lesson.status) === 2 && createdBy !== null && createdBy === updatedBy;
};

export const isGroupLessonCheckoutDisabled = ({
  isConfirmed,
  isConsumingCredits,
  isPurchasingPackage,
  isProcessingPayment,
  hasPendingCreditConfirm,
  isUsingNewCard,
  groupLessonLoading,
  isUsingCredits,
  canUseCredits,
  creditsLoading,
  hasAuthToken,
  groupLessonCancelled,
}) =>
  Boolean(
    isConfirmed ||
      isConsumingCredits ||
      isPurchasingPackage ||
      isProcessingPayment ||
      hasPendingCreditConfirm ||
      isUsingNewCard ||
      groupLessonLoading ||
      groupLessonCancelled ||
      (isUsingCredits && (!canUseCredits || creditsLoading || !hasAuthToken)),
  );

export const getGroupLessonCheckoutButtonLabel = ({
  isUsingCredits,
  isConsumingCredits,
  isProcessingPayment,
  groupLessonCancelled,
  totalPriceLabel,
}) => {
  if (groupLessonCancelled) return "Cancelled";
  if (isUsingCredits) return isConsumingCredits ? "Applying credits..." : "Pay with credits";
  if (isProcessingPayment) return "Processing Apple Pay...";
  return `Pay ${totalPriceLabel}`;
};
