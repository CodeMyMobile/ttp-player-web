import "./BookingProgressSection.css";

type BookingProgressVariant = "PENDING" | "CONFIRMED";

type BookingProgressSectionProps = {
  variant: BookingProgressVariant;
  etaText?: string;
  items: string[];
  activeIndex?: number;
  showEmailInfo: boolean;
  cancellationPolicyText: string;
};

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" aria-hidden="true">
    <circle cx="10" cy="10" r="9" />
    <path
      d="M6.2 10.2l2.3 2.4 5.3-5.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const InfoIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" aria-hidden="true">
    <circle cx="10" cy="10" r="9" />
    <path
      d="M10 8.2v6.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <circle cx="10" cy="5.6" r="1.1" fill="currentColor" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" aria-hidden="true">
    <circle cx="10" cy="10" r="9" />
    <path
      d="M10 5.5v4.7l3.2 2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BookingProgressSection = ({
  variant,
  etaText,
  items,
  activeIndex = 0,
  showEmailInfo,
  cancellationPolicyText,
}: BookingProgressSectionProps) => {
  const isPending = variant === "PENDING";
  const sectionLabel = isPending ? "WHAT HAPPENS NEXT" : "WHAT'S CONFIRMED";

  return (
    <section className="booking-progress">
      <p className="booking-progress__label">{sectionLabel}</p>

      <div className="booking-progress__list">
        {items.map((item, index) => {
          const isActive = isPending && index === activeIndex;
          return (
            <div
              key={`${item}-${index}`}
              className={`booking-progress__row${isActive ? " booking-progress__row--active" : ""}`}
            >
              <div className="booking-progress__row-left">
                {isPending ? (
                  isActive ? (
                    <CheckIcon className="booking-progress__icon booking-progress__icon--success" />
                  ) : (
                    <span className="booking-progress__step-number">{index + 1}</span>
                  )
                ) : (
                  <CheckIcon className="booking-progress__icon booking-progress__icon--success" />
                )}
              </div>
              <span className="booking-progress__row-text">{item}</span>
              {isPending && index === 1 && etaText ? (
                <span className="booking-progress__eta">{etaText}</span>
              ) : null}
            </div>
          );
        })}
      </div>

      {showEmailInfo ? (
        <div className="booking-progress__alert booking-progress__alert--info">
          <InfoIcon className="booking-progress__alert-icon" />
          <p className="booking-progress__alert-text">
            {isPending
              ? "Your payment method won't be charged until the coach confirms. If they can't accommodate this time, they may suggest alternatives."
              : "A confirmation email with lesson details has been sent to your email address."}
          </p>
        </div>
      ) : null}

      <div className="booking-progress__alert booking-progress__alert--warning">
        <ClockIcon className="booking-progress__alert-icon" />
        <p className="booking-progress__alert-text">{cancellationPolicyText}</p>
      </div>
    </section>
  );
};

export default BookingProgressSection;
