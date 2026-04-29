import { calculateLessonPricing, type LessonPricingInput } from "../../utils/lessonPricing";

type LessonPaymentSummaryProps = {
  pricing: LessonPricingInput;
  formatMoney: (value: number) => string;
};

const LessonPaymentSummary = ({ pricing, formatMoney }: LessonPaymentSummaryProps) => {
  const breakdown = calculateLessonPricing(pricing);

  return (
    <div className="coach-payment-modal__price-breakdown">
      <div className="coach-payment-modal__price-row">
        <span>Coach Fee</span>
        <strong>{formatMoney(breakdown.coachFee)}</strong>
      </div>
      <div className="coach-payment-modal__price-row">
        <span>Credit Fee (3%)</span>
        <strong>{formatMoney(breakdown.creditFee)}</strong>
      </div>
      <div className="coach-payment-modal__price-row">
        <span>Service Fee</span>
        <strong>{formatMoney(breakdown.serviceFee)}</strong>
      </div>
      <div className="coach-payment-modal__price-row coach-payment-modal__price-row--total">
        <span>Total</span>
        <strong>{formatMoney(breakdown.totalFee)}</strong>
      </div>
    </div>
  );
};

export default LessonPaymentSummary;
