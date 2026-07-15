import moment from "moment";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buildGroupLessonShareUrl } from "../../utils/shareLinks";

export type BookingStatus = "PENDING" | "CONFIRMED";

export type BookingStatusModalProps = {
  open: boolean;
  status: BookingStatus;
  onClose(): void;
  onPrimary(): void;
  onSecondary(): void;
  onAddToCalendar(): void;
  onShareWithFriends?(): void;
  onBrowsePackages?(): void;
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
    lessonId?: string;
    paymentMethodLabel?: string;
    paymentDue?: boolean;
    spotsRemainingAfterBooking?: number;
    showPackagePrompt?: boolean;
    cancellationPolicyText?: string;
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
  onBrowsePackages,
  data,
}: BookingStatusModalProps) => {
  const isPending = status === "PENDING";
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);

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

  // TODO(capture-model): steps 2 & 3 use vaguer-but-true copy. Restore the exact charge-timing
  // ("once accepted, your card is charged") and refund terms ("full refund up to 24h before") once the
  // backend Stripe capture model is confirmed — do not assert a mechanism we can't back.
  const pendingSteps = [
    `${data.coachName} reviews your request — usually within 24 hours.`,
    `Once ${data.coachName} accepts, your lesson is confirmed.`,
    "You can cancel from your reservation — see the cancellation policy.",
  ];
  const confirmedSteps = ["Your spot is reserved", "Payment processed", "Confirmation email sent"];
  const timeLabel = formatTimeLabel(data.timeLabel);
  const isConfirmedGroup = !isPending && Boolean(data.isGroup);
  const shareUrl = data.lessonId
    ? buildGroupLessonShareUrl(data.lessonId)
    : window.location.href;
  const spotsRemaining = Math.max(data.spotsRemainingAfterBooking ?? 0, 0);
  const shareMessage =
    spotsRemaining > 0
      ? `I just booked ${data.lessonTitle ?? data.lessonTypeLabel} on ${data.dateLabel} at ${timeLabel} with ${data.coachName}. ${spotsRemaining} spot${spotsRemaining === 1 ? "" : "s"} still open — come play! ${shareUrl}`
      : `I just booked ${data.lessonTitle ?? data.lessonTypeLabel} on ${data.dateLabel} at ${timeLabel} with ${data.coachName}. Join the waitlist and come play! ${shareUrl}`;

  const shareChannel = async (channel: "sms" | "whatsapp" | "email" | "copy") => {
    if (channel === "copy") {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        setCopied(false);
      }
      return;
    }

    if (channel === "sms") {
      window.location.href = `sms:?&body=${encodeURIComponent(shareMessage)}`;
      return;
    }

    if (channel === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`, "_blank", "noopener,noreferrer");
      return;
    }

    const subject = `Come play tennis with me: ${data.lessonTitle ?? data.lessonTypeLabel}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareMessage)}`;
  };

  const modalContent = isConfirmedGroup ? (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[180] flex items-stretch justify-center bg-slate-50 px-0 py-0 sm:items-center sm:bg-[rgba(15,23,42,0.55)] sm:px-4 sm:py-5"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="flex min-h-screen w-full flex-col overflow-y-auto bg-slate-50 sm:max-h-[88vh] sm:min-h-0 sm:max-w-[540px] sm:rounded-2xl sm:shadow-[0_30px_60px_rgba(0,0,0,0.3)]"
      >
        <div className="flex items-center justify-center border-b border-slate-200 bg-white px-5 py-4">
          <div className="text-[17px] font-extrabold text-slate-900">Booking confirmed</div>
        </div>

        <div className="flex-1 px-5 pb-6 pt-9">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-[78px] w-[78px] items-center justify-center rounded-full border-[3px] border-green-300 bg-green-100">
              <span className="text-4xl font-black text-green-600">✓</span>
            </div>
            <div className="mb-1 text-[26px] font-extrabold tracking-[-0.03em] text-slate-900">
              You&apos;re booked!
            </div>
            <div className="text-sm text-slate-500">See you {data.dateLabel} at {timeLabel}</div>
          </div>

          <div className="mb-5 rounded-xl border border-slate-200 bg-white p-[18px]">
            <div className="mb-4 text-[17px] font-extrabold text-slate-900">{data.lessonTitle ?? data.lessonTypeLabel}</div>
            <div className="space-y-[9px]">
              <div className="flex items-center gap-2 text-[13px] text-slate-600">
                <span>📅</span>
                <span>{data.dateLabel}</span>
              </div>
              <div className="flex items-center gap-2 text-[13px] text-slate-600">
                <span>🕐</span>
                <span>
                  {timeLabel} · {data.durationMin} min
                </span>
              </div>
              <div className="flex items-center gap-2 text-[13px] text-slate-600">
                <span>📍</span>
                <span>{data.locationName}</span>
              </div>
              <div className="flex items-center gap-2 text-[13px] text-slate-600">
                <span>👤</span>
                <span>with {data.coachName}</span>
              </div>
              <div className="my-1 h-px bg-slate-100" />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[13px] text-slate-600">
                  <span>💳</span>
	                  <span>
	                    {data.paymentDue
	                      ? `Payment due on court${data.paymentMethodLabel ? ` (${data.paymentMethodLabel})` : ""}`
	                      : `Paid with ${data.paymentMethodLabel ?? data.amountLabel}`}
	                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900">{data.amount}</div>
              </div>
            </div>
          </div>

          <div className="mb-5 rounded-xl border border-[#ddd6fe] bg-[linear-gradient(135deg,#ede9fe_0%,#f5f3ff_100%)] px-[18px] py-4">
            <div className="mb-[14px]">
              <div className="text-[15px] font-extrabold text-slate-900">Bring a friend 🎾</div>
              <div className="mt-[3px] text-[12.5px] leading-[1.45] text-slate-600">
                {spotsRemaining > 0
                  ? `${spotsRemaining} spot${spotsRemaining === 1 ? "" : "s"} still available — share this class so friends can book the same session`
                  : "Class is full — friends can join the waitlist"}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void shareChannel("sms")}
                className="flex flex-1 flex-col items-center gap-[5px] rounded-[10px] border border-slate-200 bg-white px-[6px] py-[11px] text-xs font-bold text-slate-700"
              >
                <span className="text-lg">💬</span>
                <span>Message</span>
              </button>
              <button
                type="button"
                onClick={() => void shareChannel("whatsapp")}
                className="flex flex-1 flex-col items-center gap-[5px] rounded-[10px] border border-slate-200 bg-white px-[6px] py-[11px] text-xs font-bold text-slate-700"
              >
                <span className="text-lg">🟢</span>
                <span>WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => void shareChannel("email")}
                className="flex flex-1 flex-col items-center gap-[5px] rounded-[10px] border border-slate-200 bg-white px-[6px] py-[11px] text-xs font-bold text-slate-700"
              >
                <span className="text-lg">📧</span>
                <span>Email</span>
              </button>
              <button
                type="button"
                onClick={() => void shareChannel("copy")}
                className={`flex flex-1 flex-col items-center gap-[5px] rounded-[10px] border px-[6px] py-[11px] text-xs font-bold ${
                  copied ? "border-green-600 bg-green-100 text-green-700" : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <span className="text-lg">{copied ? "✓" : "🔗"}</span>
                <span>{copied ? "Copied!" : "Copy link"}</span>
              </button>
            </div>
          </div>

          {data.showPackagePrompt && onBrowsePackages ? (
            <button
              type="button"
              onClick={onBrowsePackages}
              className="mb-[22px] flex w-full items-center gap-[14px] rounded-xl border border-slate-200 bg-white px-[18px] py-4 text-left"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#ede9fe] text-xl">💡</div>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-bold text-slate-900">Book this weekly? Save with class packs</div>
                <div className="mt-[2px] text-[12.5px] text-slate-500">Use credits for future group bookings and skip card entry next time.</div>
              </div>
              <span className="text-lg font-bold text-[var(--color-primary)]">→</span>
            </button>
          ) : null}

          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-400">
            Add to calendar
          </div>
          <div className="mb-[22px] flex gap-[10px]">
            <button
              type="button"
              onClick={onAddToCalendar}
              className="flex flex-1 items-center justify-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-3 text-[13px] font-bold text-slate-700"
            >
              📅 iCal
            </button>
            <button
              type="button"
              onClick={onAddToCalendar}
              className="flex flex-1 items-center justify-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-3 text-[13px] font-bold text-slate-700"
            >
              🗓 Google Calendar
            </button>
          </div>

          <div className="flex gap-[10px] rounded-[10px] border border-amber-200 bg-amber-100 px-4 py-3">
            <span className="text-[15px]">⚠️</span>
            <div className="text-[12.5px] leading-[1.5] text-amber-900">
              {data.cancellationPolicyText ??
                "Cancel at least 24 hours before your class for a full refund or credit. Cancellations within 24 hours are non-refundable."}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white px-5 py-[14px]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onSecondary}
              className="hidden rounded-xl border border-slate-200 px-4 py-[14px] text-sm font-bold text-slate-700 sm:block"
            >
              My Bookings
            </button>
            <button
              type="button"
              onClick={onPrimary}
              className="rounded-xl bg-[var(--color-primary)] px-4 py-[14px] text-sm font-bold text-white"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : isPending ? (
    // PR 4 — pending confirmation (Screen 4): amber, request-awaiting-approval, full-screen "page".
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[180] flex items-stretch justify-center bg-slate-50 px-0 py-0 sm:items-center sm:bg-[rgba(15,23,42,0.55)] sm:px-4 sm:py-5"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="flex min-h-screen w-full flex-col overflow-y-auto bg-slate-50 sm:max-h-[88vh] sm:min-h-0 sm:max-w-[480px] sm:rounded-2xl sm:shadow-[0_30px_60px_rgba(0,0,0,0.3)]"
      >
        <div className="flex items-center justify-end border-b border-slate-200 bg-white px-5 py-4">
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            ×
          </button>
        </div>

        <div className="flex-1 px-5 pb-6 pt-9">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-[78px] w-[78px] items-center justify-center rounded-full border-[3px] border-amber-300 bg-amber-100">
              <ClockIcon className="h-10 w-10 text-amber-600" />
            </div>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-amber-700">
              <DotIcon className="bg-amber-500" /> Pending · awaiting {data.coachName}
            </div>
            <div className="mb-1 text-[24px] font-extrabold tracking-[-0.02em] text-slate-900">
              Request sent to {data.coachName}
            </div>
            <p className="mx-auto max-w-[320px] text-sm text-slate-500">
              Your lesson isn’t booked just yet — {data.coachName} reviews every request, usually within 24 hours.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-500">Type</span>
                <span className="text-right text-sm font-semibold text-slate-900">{data.lessonTypeLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-500">When</span>
                <span className="text-right text-sm font-semibold text-slate-900">{data.dateLabel} · {timeLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-500">Where</span>
                <span className="text-right text-sm font-semibold text-slate-900">{data.locationName}</span>
              </div>
              {/* Money-truthfulness: labeled "Total" (FE-computed, pending — nothing charged yet). */}
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5">
                <span className="text-sm text-slate-500">Total</span>
                <span className="text-right text-sm font-bold text-slate-900">{data.amount}</span>
              </div>
            </div>
            {data.lessonId ? (
              <button
                onClick={onPrimary}
                className="mt-3 flex w-full items-center justify-center gap-1 text-sm font-semibold text-violet-600"
              >
                View lesson reservation →
              </button>
            ) : null}
          </div>

          <p className="mt-4 text-center text-[13px] text-slate-500">
            {data.coachName} reviews each request to make sure the time works.
          </p>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">What happens next</p>
            <div className="mt-3 space-y-2.5">
              {pendingSteps.map((text, index) => (
                <div key={text} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-700">
                    {index + 1}
                  </span>
                  <span className="text-sm text-slate-600">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2 border-t border-slate-200 bg-white px-5 py-4">
          {data.lessonId ? (
            <button
              onClick={onPrimary}
              className="w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-bold text-white hover:bg-violet-600"
            >
              View my reservation
            </button>
          ) : null}
          <button
            onClick={onSecondary}
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Back to coaches
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[180] flex items-center justify-center bg-black/30 px-3 py-4 sm:px-4"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[420px] overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-6"
      >
        <button
          onClick={onClose}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"
          aria-label="Close"
        >
          ×
        </button>

        <div className="mt-2 flex gap-3 sm:gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckIcon className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 sm:text-[22px]">
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

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
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

  if (typeof document === "undefined") {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
};

export default BookingStatusModal;
