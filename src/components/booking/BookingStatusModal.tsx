import moment from "moment";
import { useEffect, useRef } from "react";

export type BookingStatus = "PENDING" | "CONFIRMED";

export type BookingStatusModalProps = {
  open: boolean;
  status: BookingStatus;
  onClose(): void;
  onPrimary(): void;
  onSecondary(): void;
  onAddToCalendar(): void;
  onShareWithFriends?(): void;
  data: {
    coachName: string;
    coachInitials: string;
    lessonTitle?: string;
    lessonSubtitle?: string;
    skillRange?: string;
    lessonTypeLabel: string;
    isGroup?: boolean;
    durationMin: number;
    dateLabel: string;
    timeLabel: string;
    locationName: string;
    locationAddress: string;
    amountLabel: string;
    amount: string;
    etaText?: string;
  };
};

const CheckIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 20 20" className={className} aria-hidden>
    <circle cx="10" cy="10" r="9" className="fill-emerald-100 stroke-emerald-400" strokeWidth="1" />
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
  <svg viewBox="0 0 20 20" className={className} aria-hidden>
    <circle cx="10" cy="10" r="9" className="fill-blue-50 stroke-blue-400" strokeWidth="1" />
    <path d="M10 8.2v6.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="10" cy="5.6" r="1.1" fill="currentColor" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 20 20" className={className} aria-hidden>
    <circle cx="10" cy="10" r="9" className="fill-orange-50 stroke-orange-400" strokeWidth="1" />
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

const DotIcon = ({ className }: { className?: string }) => (
  <span className={`inline-block h-2 w-2 rounded-full ${className}`} />
);

const formatTimeLabel = (value: string) => {
  console.log("formatTimeLabel", value);
  if (!value || !value.includes("T")) {
    return value;
  }
  const separatorMatch = value.match(/\s[–-]\s/);
  if (separatorMatch) {
    const separator = separatorMatch[0];
    const [startRaw, endRaw] = value.split(separator);
    const start = moment.utc(startRaw.trim());
    const end = moment.utc(endRaw.trim());
    if (start.isValid() && end.isValid()) {
      return `${start.local().format("h:mm A")} – ${end.local().format("h:mm A")}`;
    }
  }
  const parsed = moment.utc(value.trim());
  return parsed.isValid() ? parsed.local().format("h:mm A") : value;
};

const BookingStatusModal = ({
  open,
  status,
  onClose,
  onPrimary,
  onSecondary,
  onAddToCalendar,
  onShareWithFriends,
  data,
}: BookingStatusModalProps) => {
  const isPending = status === "PENDING";
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !modalRef.current) return;
    const el = modalRef.current;
    const focusables = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    el.addEventListener("keydown", onKeyDown);
    first?.focus();
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  const pendingSteps = [
    "Request sent to coach",
    "Coach confirms availability",
    "You'll receive email confirmation",
    "Payment processed",
  ];
  const confirmedSteps = ["Your spot is reserved", "Payment processed", "Confirmation email sent"];
  const timeLabel = formatTimeLabel(data.timeLabel);
console.log("data", data);
console.log("timeLabel", timeLabel);
  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose();
      }}
    >
      <div ref={modalRef} className="w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-xl">
        <button
          onClick={onClose}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"
          aria-label="Close"
        >
          ×
        </button>

        <div className="mt-2 flex gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckIcon className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-[22px] font-bold text-gray-900">
              {isPending ? "Lesson request sent!" : "You’re booked!"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {isPending
                ? "Your request has been sent to your coach for confirmation."
                : "Your spot in this group lesson has been confirmed."}
            </p>
          </div>
        </div>

        <div
          className={`mt-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${
            isPending
              ? "border-yellow-200 bg-yellow-50 text-orange-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {isPending ? <DotIcon className="bg-orange-500" /> : <CheckIcon className="h-4 w-4 text-emerald-700" />}
          <span>{isPending ? "Awaiting coach response" : "Booking confirmed"}</span>
        </div>

        <div className="mt-5 rounded-2xl bg-gray-50 p-4">
          {!isPending ? (
            <div className="mb-4">
              <div className="flex items-start justify-between gap-2">
                <div className="text-base font-semibold text-gray-900">{data.lessonTitle}</div>
                {data.skillRange ? (
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">
                    {data.skillRange}
                  </span>
                ) : null}
              </div>
              {data.lessonSubtitle ? (
                <div className="mt-1 text-sm text-gray-500">{data.lessonSubtitle}</div>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">
              {data.coachInitials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{data.coachName}</span>
                {!isPending && data.isGroup ? (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    GROUP
                  </span>
                ) : null}
              </div>
              <div className="text-sm text-gray-500">
                {data.lessonTypeLabel} • {data.durationMin} min
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-200 text-gray-600">
                📅
              </div>
              <div>
                <div className="font-semibold text-gray-900">{data.dateLabel}</div>
                <div className="text-sm text-gray-500">{timeLabel}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-200 text-gray-600">
                📍
              </div>
              <div>
                <div className="font-semibold text-gray-900">{data.locationName}</div>
                <div className="text-sm text-gray-500">{data.locationAddress}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-3">
            <span className="text-sm text-gray-500">{data.amountLabel}</span>
            <span className="text-base font-semibold text-blue-600">{data.amount}</span>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <button
            onClick={onAddToCalendar}
            className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Add to calendar
          </button>
          {!isPending && onShareWithFriends ? (
            <button
              onClick={onShareWithFriends}
              className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Share with friends
            </button>
          ) : null}
        </div>

        <div className="mt-5 rounded-2xl bg-gray-50 p-4">
          <p className="text-[11px] font-bold tracking-[0.18em] text-gray-400">
            {isPending ? "WHAT HAPPENS NEXT" : "WHAT’S CONFIRMED"}
          </p>

          <div className="mt-3 space-y-2">
            {(isPending ? pendingSteps : confirmedSteps).map((text, index) => {
              const active = isPending && index === 0;
              return (
                <div
                  key={text}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                    isPending
                      ? active
                        ? "bg-emerald-50"
                        : "bg-white border border-gray-200"
                      : "bg-emerald-50"
                  }`}
                >
                  {isPending ? (
                    active ? (
                      <CheckIcon className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-[10px] font-bold text-gray-500">
                        {index + 1}
                      </span>
                    )
                  ) : (
                    <CheckIcon className="h-5 w-5 text-emerald-600" />
                  )}
                  <span className="flex-1 text-sm font-semibold text-gray-900">{text}</span>
                  {isPending && index === 1 && data.etaText ? (
                    <span className="text-xs font-semibold text-gray-400">{data.etaText}</span>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-blue-700">
            <InfoIcon className="h-5 w-5 text-blue-600" />
            <p className="text-sm font-semibold">
              {isPending
                ? "Your payment method won't be charged until the coach confirms. If they can't accommodate this time, they may suggest alternatives."
                : "A confirmation email with lesson details has been sent to your email address."}
            </p>
          </div>

          <div className="mt-2 flex gap-2 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-orange-700">
            <ClockIcon className="h-5 w-5 text-orange-600" />
            <p className="text-sm font-semibold">
              {data.cancellationPolicyText}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onSecondary}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            My Bookings
          </button>
          <button
            onClick={onPrimary}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {isPending ? "Got it" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingStatusModal;
