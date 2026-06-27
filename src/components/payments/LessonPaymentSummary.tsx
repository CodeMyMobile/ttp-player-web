import { calculateLessonPricing, type LessonPricingInput } from "../../utils/lessonPricing";

type LessonPaymentSummaryProps = {
  pricing: LessonPricingInput;
  formatMoney: (value: number) => string;
};

const LessonPaymentSummary = ({ pricing, formatMoney }: LessonPaymentSummaryProps) => {
  // TODO(quote-endpoint): these fee amounts are FE-computed in lessonPricing.ts and are NOT sent to
  // the backend (it charges off lesson_id). The displayed total only equals the Stripe charge while the
  // FE formula matches BE pricing. When a server quote/total endpoint exists, render its breakdown here
  // (this component is the single repoint seam) instead of calculateLessonPricing.
  const breakdown = calculateLessonPricing(pricing);

  return (
    <div className="coach-payment-modal__price-breakdown">
      <div className="coach-payment-modal__price-row">
        <span>Lesson</span>
        <strong>{formatMoney(breakdown.coachFee)}</strong>
      </div>
      <div className="coach-payment-modal__price-row">
        <span>Booking fee</span>
        <strong>{formatMoney(breakdown.serviceFee)}</strong>
      </div>
      <div className="coach-payment-modal__price-row">
        <span>Card processing</span>
        <strong>{formatMoney(breakdown.creditFee)}</strong>
      </div>
      <div className="coach-payment-modal__price-row coach-payment-modal__price-row--total">
        <span>Total</span>
        <strong>{formatMoney(breakdown.totalFee)}</strong>
      </div>
      <p className="coach-payment-modal__price-note">
        <b>No lesson commission.</b> Coaches keep their full rate — the fees cover booking and card costs.
      </p>
    </div>
  );
};

export default LessonPaymentSummary;
