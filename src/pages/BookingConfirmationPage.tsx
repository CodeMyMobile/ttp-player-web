import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Apple,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  MapPin,
  Package,
  ShieldCheck,
  Star,
  Users,
  Wallet,
} from "lucide-react";

import MainLayout from "../components/MainLayout";
import GroupLessonConfirmationModal from "../components/group-lessons/GroupLessonConfirmationModal";
import PrivateLessonConfirmationModal from "../components/private-lessons/PrivateLessonConfirmationModal";
import { findCoachProfile, type GroupParticipant } from "../data/mockCoachProfiles";
import { findGroupLessonById } from "../data/mockGroupLessons";

import "./BookingConfirmationPage.css";

type SavedCard = {
  id: string;
  brand: string;
  last4: string;
  expiry: string;
  nickname?: string;
  isDefault?: boolean;
};

const savedPaymentMethods: SavedCard[] = [
  { id: "card-personal", brand: "Visa", last4: "4242", expiry: "04/26", nickname: "Personal", isDefault: true },
  { id: "card-club", brand: "Mastercard", last4: "1188", expiry: "11/25", nickname: "Club expenses" },
];

const lessonCreditWallet = {
  id: "lesson-credits",
  label: "Adult 60-min private lesson credits",
  balance: 2,
  creditValue: "$85 value per credit",
  expiresLabel: "2 credits expire May 31",
};

type NewCardFormState = {
  name: string;
  number: string;
  expiry: string;
  cvc: string;
  postalCode: string;
};

type LocationState = {
  coachId?: number;
  dateId?: string;
  slotId?: string;
  groupLessonId?: string;
};

const MINUTES_PER_DAY = 24 * 60;

const parseTimeToMinutes = (timeLabel: string) => {
  const match = timeLabel.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return null;
  }

  const [, hourPart, minutePart, periodRaw] = match;
  let hours = Number.parseInt(hourPart, 10);
  const minutes = Number.parseInt(minutePart, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  const period = periodRaw.toUpperCase();
  hours %= 12;
  if (period === "PM") {
    hours += 12;
  }

  return hours * 60 + minutes;
};

const parseDurationToMinutes = (durationLabel: string) => {
  const match = durationLabel.match(/(\d+)\s*min/i);
  if (!match) {
    return null;
  }

  const [, durationPart] = match;
  const duration = Number.parseInt(durationPart, 10);
  return Number.isNaN(duration) ? null : duration;
};

const formatMinutesToTimeLabel = (totalMinutes: number) => {
  const minutesNormalized = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours24 = Math.floor(minutesNormalized / 60);
  const minutes = minutesNormalized % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
};

const buildTimeRangeLabel = (startLabel: string, durationLabel: string) => {
  const startMinutes = parseTimeToMinutes(startLabel);
  const durationMinutes = parseDurationToMinutes(durationLabel);

  if (startMinutes == null || durationMinutes == null) {
    return startLabel;
  }

  const endMinutes = startMinutes + durationMinutes;
  return `${formatMinutesToTimeLabel(startMinutes)} - ${formatMinutesToTimeLabel(endMinutes)}`;
};

const extractPlayerCapacity = (lessonDurationLabel?: string) => {
  if (!lessonDurationLabel) {
    return undefined;
  }

  const rangeMatch = lessonDurationLabel.match(/(\d+)\s*-\s*(\d+)\s*players?/i);
  if (rangeMatch) {
    const [, , maxPart] = rangeMatch;
    const maxPlayers = Number.parseInt(maxPart, 10);
    if (!Number.isNaN(maxPlayers)) {
      return maxPlayers;
    }
  }

  const singleMatch = lessonDurationLabel.match(/(\d+)\s*players?/i);
  if (singleMatch) {
    const [, countPart] = singleMatch;
    const players = Number.parseInt(countPart, 10);
    if (!Number.isNaN(players)) {
      return players;
    }
  }

  return undefined;
};

const dayNameMap: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

const BookingConfirmationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as LocationState | undefined;
  const searchParams = new URLSearchParams(location.search);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>(savedPaymentMethods[0]?.id ?? "apple-pay");
  const [newCardForm, setNewCardForm] = useState<NewCardFormState>({
    name: "",
    number: "",
    expiry: "",
    cvc: "",
    postalCode: "",
  });
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);

  const coachIdFromState = state?.coachId;
  const dateIdFromState = state?.dateId;
  const slotIdFromState = state?.slotId;
  const groupLessonIdFromState = state?.groupLessonId;

  const coachIdParam = searchParams.get("coach");
  const dateIdParam = searchParams.get("date");
  const slotIdParam = searchParams.get("slot");
  const groupLessonParam = searchParams.get("groupLesson");

  const coachId = coachIdFromState ?? (coachIdParam ? Number.parseInt(coachIdParam, 10) : undefined);
  const dateId = dateIdFromState ?? dateIdParam ?? undefined;
  const slotId = slotIdFromState ?? slotIdParam ?? undefined;
  const groupLessonId = groupLessonIdFromState ?? groupLessonParam ?? undefined;

  const profile = coachId != null ? findCoachProfile(coachId) : undefined;
  const groupLesson = groupLessonId ? findGroupLessonById(groupLessonId) : undefined;

  const selectedDate = profile?.booking.availableDates.find((date) => date.id === dateId);
  const selectedSlot = selectedDate?.slots.find((slot) => slot.id === slotId);

  const lessonDetails = selectedSlot ? profile?.booking.lessonTypes.find((type) => type.id === selectedSlot.lessonType) : undefined;

  const isProfileGroupLesson = selectedSlot?.lessonType === "group";
  const isGroupLesson = Boolean(groupLesson) || isProfileGroupLesson;

  const timeRange = groupLesson
    ? buildTimeRangeLabel(groupLesson.startTime, `${groupLesson.durationMinutes} min`)
    : selectedSlot
      ? buildTimeRangeLabel(selectedSlot.time, selectedSlot.duration)
      : undefined;
  const locationLabel = groupLesson?.locationName ?? profile?.location ?? profile?.coachingLocations[0];
  const resolvedCoachName = groupLesson?.coachName ?? profile?.name ?? "your coach";
  const coachName = resolvedCoachName;
  const coachFirstName = resolvedCoachName.split(" ")[0] ?? resolvedCoachName;
  const lessonDateLabel = groupLesson?.date
    ? groupLesson.date
    : selectedDate
      ? `${dayNameMap[selectedDate.day] ?? selectedDate.day}, ${selectedDate.label}`
      : undefined;

  const capacity = groupLesson
    ? groupLesson.totalSpots
    : isProfileGroupLesson
      ? extractPlayerCapacity(lessonDetails?.duration)
      : undefined;
  const spotsLabel = useMemo(() => {
    if (groupLesson) {
      const remaining = Math.max(groupLesson.availableSpots, 0);
      return `${remaining} spot${remaining === 1 ? "" : "s"} available`;
    }

    if (!selectedSlot || !isProfileGroupLesson) {
      return undefined;
    }

    const remaining = Math.max(selectedSlot.spotsRemaining, 0);
    if (capacity) {
      return `${Math.min(remaining, capacity)}/${capacity} spots available`;
    }

    return `${remaining} spot${remaining === 1 ? "" : "s"} available`;
  }, [capacity, groupLesson, isProfileGroupLesson, selectedSlot]);

  const participants = useMemo<GroupParticipant[]>(() => {
    if (groupLesson) {
      return groupLesson.participants;
    }

    if (!isProfileGroupLesson) {
      return [];
    }

    return selectedSlot?.participants ?? [];
  }, [groupLesson, isProfileGroupLesson, selectedSlot]);

  const participantCount = participants.length;
  const openSpots = useMemo(() => {
    if (groupLesson) {
      return Math.max(groupLesson.availableSpots, 0);
    }

    if (!isProfileGroupLesson) {
      return 0;
    }

    if (capacity != null) {
      return Math.max(capacity - participantCount, 0);
    }

    return Math.max(selectedSlot?.spotsRemaining ?? 0, 0);
  }, [capacity, groupLesson, isProfileGroupLesson, participantCount, selectedSlot]);

  const rosterCaption = useMemo(() => {
    if (groupLesson) {
      const base = `${participantCount}/${groupLesson.totalSpots} players confirmed`;
      if (openSpots === 0) {
        return `${base} • Full`;
      }
      return `${base} • ${openSpots} spot${openSpots === 1 ? "" : "s"} open`;
    }

    if (!isProfileGroupLesson) {
      return undefined;
    }

    if (capacity != null) {
      const base = `${participantCount}/${capacity} players confirmed`;
      if (openSpots === 0) {
        return `${base} • Full`;
      }
      return `${base} • ${openSpots} spot${openSpots === 1 ? "" : "s"} open`;
    }

    if (participantCount === 0) {
      return openSpots > 0
        ? `${openSpots} spot${openSpots === 1 ? "" : "s"} open`
        : "No spots currently available";
    }

    const base = `${participantCount} player${participantCount === 1 ? "" : "s"} confirmed`;
    return openSpots > 0 ? `${base} • ${openSpots} spot${openSpots === 1 ? "" : "s"} open` : base;
  }, [capacity, groupLesson, isProfileGroupLesson, openSpots, participantCount]);

  const getInitials = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return "";
    }
    const parts = trimmed.split(/\s+/).slice(0, 2);
    return parts
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  };

  const lessonLabel = groupLesson
    ? groupLesson.title
    : lessonDetails?.label ?? (selectedSlot?.lessonType === "private" ? "Private lesson" : "Group lesson");
  const coachAvatar = groupLesson?.coachAvatarUrl ?? profile?.imageUrl;
  const coachTitle = profile?.title ?? (groupLesson ? `${groupLesson.skillLabel} • Group session` : undefined);
  const coachRating = profile?.rating;
  const coachReviewCount = profile?.reviewCount;
  const durationLabel = groupLesson ? `${groupLesson.durationMinutes} min` : selectedSlot?.duration;
  const confirmTitle = groupLesson ? `Confirm your spot in ${groupLesson.title}` : `Confirm your lesson with ${coachName}`;
  const backButtonLabel = groupLesson ? "Back to lesson details" : "Back to availability";
  const backButtonDestination = groupLesson ? `/group-lessons/${groupLesson.id}` : undefined;
  const adjustCopy = groupLesson
    ? "You can return to the lesson details to review what's included before confirming."
    : "You can return to availability and pick a different time or lesson type at any point before submitting your request.";
  const adjustButtonLabel = groupLesson ? "Back to lesson details" : "Choose a different slot";

  const handleAdjustNavigation = () => {
    if (groupLesson) {
      navigate(`/group-lessons/${groupLesson.id}`);
      return;
    }
    navigate(-1);
  };

  const headlineSubtitle = isGroupLesson
    ? `Secure your spot instantly in ${coachFirstName}'s group lesson — no coach approval needed.`
    : `Lock in your preferred time. We’ll notify ${coachFirstName} once you submit the request.`;

  const selectedSavedCard = savedPaymentMethods.find((card) => card.id === paymentMethod);
  const canUseCredits = lessonCreditWallet.balance > 0;
  const isUsingCredits = paymentMethod === "credits";
  const isUsingApplePay = paymentMethod === "apple-pay";
  const isUsingNewCard = paymentMethod === "new-card";

  const remainingCredits = Math.max(lessonCreditWallet.balance - 1, 0);
  const remainingCreditsLabel = remainingCredits === 0 ? "no credits" : `${remainingCredits} credit${remainingCredits === 1 ? "" : "s"}`;

  const priceLabel = isUsingCredits
    ? "Credit to apply"
    : isGroupLesson
      ? "Total due today"
      : "Total due now";

  const priceValue = isUsingCredits
    ? `1 lesson credit${lessonCreditWallet.creditValue ? ` (${lessonCreditWallet.creditValue})` : ""}`
    : groupLesson?.pricePerPlayer ?? selectedSlot?.price ?? "--";

  const priceCaption = (() => {
    if (isUsingCredits) {
      const expiresMessage = lessonCreditWallet.expiresLabel ? ` ${lessonCreditWallet.expiresLabel}.` : "";
      return `We'll deduct 1 credit from your balance. You'll have ${remainingCreditsLabel} remaining.${expiresMessage}`;
    }
    if (isUsingApplePay) {
      return isGroupLesson
        ? "Charged instantly via Apple Pay."
        : "Apple Pay will only be charged after the coach approves.";
    }
    if (isUsingNewCard) {
      return isGroupLesson
        ? "Charged immediately once the card is saved."
        : "We'll only charge this card after the coach approves.";
    }
    if (selectedSavedCard) {
      const cardLabel = `${selectedSavedCard.brand} •••• ${selectedSavedCard.last4}`;
      return isGroupLesson
        ? `Charged immediately to ${cardLabel}.`
        : `We'll place a hold and charge ${cardLabel} after approval.`;
    }
    return isGroupLesson ? "Charged immediately to hold your spot." : "Charged only after the coach approves.";
  })();

  const confirmButtonLabel = (() => {
    if (isUsingCredits) {
      return isGroupLesson ? "Confirm with credits" : "Request with credits";
    }
    if (isUsingApplePay) {
      return isGroupLesson ? "Confirm with Apple Pay" : "Request with Apple Pay";
    }
    if (isUsingNewCard) {
      return isGroupLesson ? "Confirm with new card" : "Request with new card";
    }
    return isGroupLesson ? "Confirm with saved card" : "Request with saved card";
  })();

  const disclaimerCopy = (() => {
    if (isUsingCredits) {
      return isGroupLesson
        ? "Credit is deducted immediately to secure your spot."
        : "We reserve the credit but only deduct it after coach approval.";
    }
    return isGroupLesson
      ? "Your lesson is confirmed instantly when spots are available."
      : "You won’t be charged until the coach confirms.";
  })();

  const isNewCardValid = useMemo(() => {
    if (!isUsingNewCard) {
      return true;
    }
    const trimmedNumber = newCardForm.number.replace(/\s+/g, "");
    return (
      newCardForm.name.trim().length > 1 &&
      trimmedNumber.length >= 15 &&
      newCardForm.expiry.trim().length >= 4 &&
      newCardForm.cvc.trim().length >= 3 &&
      newCardForm.postalCode.trim().length >= 3
    );
  }, [isUsingNewCard, newCardForm]);

  const isConfirmDisabled = isConfirmed || !isNewCardValid || (isUsingCredits && !canUseCredits);

  const handleConfirm = () => {
    setIsConfirmed(true);
    if (groupLesson || !isGroupLesson) {
      setIsConfirmationModalOpen(true);
    }
  };

  const privateLessonStart = useMemo(() => {
    if (isGroupLesson || !selectedDate || !selectedSlot) {
      return undefined;
    }

    const startMinutes = parseTimeToMinutes(selectedSlot.time);
    if (startMinutes == null) {
      return undefined;
    }

    const [yearPart, monthPart, dayPart] = (selectedDate.id ?? "").split("-");
    const year = Number.parseInt(yearPart ?? "", 10);
    const month = Number.parseInt(monthPart ?? "", 10);
    const day = Number.parseInt(dayPart ?? "", 10);

    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
      return undefined;
    }

    const hours = Math.floor(startMinutes / 60);
    const minutes = startMinutes % 60;
    const startDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
    return startDate;
  }, [isGroupLesson, selectedDate, selectedSlot]);

  const privateLessonEnd = useMemo(() => {
    if (!privateLessonStart || !selectedSlot?.duration) {
      return undefined;
    }

    const durationMinutes = parseDurationToMinutes(selectedSlot.duration);
    if (durationMinutes == null) {
      return undefined;
    }

    return new Date(privateLessonStart.getTime() + durationMinutes * 60 * 1000);
  }, [privateLessonStart, selectedSlot?.duration]);

  const lessonStatusLabel = isGroupLesson ? "Confirmed" : "Pending coach approval";

  const savedCardsSection = (
    <div className="payment-methods__group">
      <span className="payment-methods__group-label">Saved cards</span>
      <div className="payment-methods__stack">
        {savedPaymentMethods.map((card) => {
          const isSelected = paymentMethod === card.id;
          return (
            <label key={card.id} className={`payment-method-card${isSelected ? " payment-method-card--selected" : ""}`}>
              <input
                type="radio"
                name="payment-method"
                value={card.id}
                checked={isSelected}
                onChange={() => setPaymentMethod(card.id)}
              />
              <span className="payment-method-card__selector" aria-hidden />
              <span className="payment-method-card__icon">
                <CreditCard aria-hidden size={18} />
              </span>
              <span className="payment-method-card__body">
                <span className="payment-method-card__title">{card.brand} ending in {card.last4}</span>
                <span className="payment-method-card__subtitle">
                  Expires {card.expiry}
                  {card.nickname ? ` • ${card.nickname}` : ""}
                </span>
              </span>
              {card.isDefault ? <span className="payment-method-card__tag">Default</span> : null}
            </label>
          );
        })}

        <label className={`payment-method-card payment-method-card--new${isUsingNewCard ? " payment-method-card--selected" : ""}`}>
          <input
            type="radio"
            name="payment-method"
            value="new-card"
            checked={isUsingNewCard}
            onChange={() => setPaymentMethod("new-card")}
          />
          <span className="payment-method-card__selector" aria-hidden />
          <span className="payment-method-card__icon">
            <CreditCard aria-hidden size={18} />
          </span>
          <span className="payment-method-card__body">
            <span className="payment-method-card__title">Add a new credit card</span>
            <span className="payment-method-card__subtitle">Securely save it for future lessons.</span>
          </span>
        </label>

        {isUsingNewCard ? (
          <div className="payment-method-card__form" role="group" aria-label="New card details">
            <div className="payment-method-card__form-row">
              <label className="payment-method-card__form-field">
                <span>Cardholder name</span>
                <input
                  type="text"
                  value={newCardForm.name}
                  onChange={(event) => setNewCardForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Name on card"
                />
              </label>
            </div>
            <div className="payment-method-card__form-row payment-method-card__form-row--split">
              <label className="payment-method-card__form-field">
                <span>Card number</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newCardForm.number}
                  onChange={(event) => setNewCardForm((prev) => ({ ...prev, number: event.target.value }))}
                  placeholder="1234 1234 1234 1234"
                />
              </label>
            </div>
            <div className="payment-method-card__form-row payment-method-card__form-row--grid">
              <label className="payment-method-card__form-field">
                <span>Expiration</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newCardForm.expiry}
                  onChange={(event) => setNewCardForm((prev) => ({ ...prev, expiry: event.target.value }))}
                  placeholder="MM/YY"
                />
              </label>
              <label className="payment-method-card__form-field">
                <span>CVC</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newCardForm.cvc}
                  onChange={(event) => setNewCardForm((prev) => ({ ...prev, cvc: event.target.value }))}
                  placeholder="123"
                />
              </label>
              <label className="payment-method-card__form-field">
                <span>ZIP code</span>
                <input
                  type="text"
                  inputMode="text"
                  value={newCardForm.postalCode}
                  onChange={(event) => setNewCardForm((prev) => ({ ...prev, postalCode: event.target.value }))}
                  placeholder="12345"
                />
              </label>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  const digitalWalletSection = (
    <div className="payment-methods__group">
      <span className="payment-methods__group-label">Digital wallet</span>
      <label className={`payment-method-card payment-method-card--wallet${isUsingApplePay ? " payment-method-card--selected" : ""}`}>
        <input
          type="radio"
          name="payment-method"
          value="apple-pay"
          checked={isUsingApplePay}
          onChange={() => setPaymentMethod("apple-pay")}
        />
        <span className="payment-method-card__selector" aria-hidden />
        <span className="payment-method-card__icon">
          <Apple aria-hidden size={18} />
        </span>
        <span className="payment-method-card__body">
          <span className="payment-method-card__title">Apple Pay</span>
          <span className="payment-method-card__subtitle">Pay instantly with your saved wallet.</span>
        </span>
      </label>
    </div>
  );

  const lessonCreditsSection = (
    <div className="payment-methods__group">
      <span className="payment-methods__group-label">Lesson credits</span>
      <label
        className={`payment-method-card payment-method-card--credits${
          isUsingCredits ? " payment-method-card--selected" : ""
        }${canUseCredits ? "" : " payment-method-card--disabled"}`}
      >
        <input
          type="radio"
          name="payment-method"
          value="credits"
          checked={isUsingCredits}
          onChange={() => setPaymentMethod("credits")}
          disabled={!canUseCredits}
        />
        <span className="payment-method-card__selector" aria-hidden />
        <span className="payment-method-card__icon">
          <Wallet aria-hidden size={18} />
        </span>
        <span className="payment-method-card__body">
          <span className="payment-method-card__title">Use lesson credits</span>
          <span className="payment-method-card__subtitle">
            {canUseCredits
              ? `${lessonCreditWallet.balance} credit${lessonCreditWallet.balance === 1 ? "" : "s"} available • ${lessonCreditWallet.label}`
              : "No credits available for this lesson type."}
          </span>
        </span>
        {lessonCreditWallet.expiresLabel && canUseCredits ? (
          <span className="payment-method-card__tag payment-method-card__tag--success">{lessonCreditWallet.expiresLabel}</span>
        ) : null}
      </label>
      {isUsingCredits ? (
        <div className="payment-methods__credits-note">
          Applying one credit will cover this lesson. You'll have {remainingCreditsLabel} after booking.
        </div>
      ) : null}
    </div>
  );

  const nextStepsItems = isGroupLesson
    ? [
        "Your spot is reserved immediately as long as space remains.",
        "We'll email your receipt and lesson details right away.",
        "Manage your booking or make changes from your dashboard.",
      ]
    : [
        `Your request is sent directly to ${coachFirstName} for review.`,
        "You'll receive an email as soon as the coach confirms.",
        `Once approved, your booking is confirmed and payment is processed.`,
      ];

  const confirmationStatus = isGroupLesson
    ? {
        title: "Lesson confirmed!",
        copy: `You're all set for ${lessonDateLabel ?? "your upcoming lesson"} at ${timeRange ?? selectedSlot?.time}. We'll send a receipt to your email and keep you posted on any updates.`,
      }
    : {
        title: "Booking request sent!",
        copy: `We've notified ${coachFirstName}. You'll hear from us as soon as they confirm—your payment will only process after approval.`,
      };

  const shouldShowEmptyState = groupLessonId
    ? !groupLesson
    : !profile || !selectedDate || !selectedSlot;

  if (shouldShowEmptyState) {
    const emptyTitle = groupLessonId
      ? "We couldn't find that group lesson"
      : "We couldn't load that booking";
    const emptyCopy = groupLessonId
      ? "The session may have filled or is no longer available. Explore other group lessons to keep the momentum going."
      : "The booking details expired or were missing. Please return to the coach listings to choose an available lesson.";
    const emptyActionLabel = groupLessonId ? "View group lessons" : "Browse coaches";
    const emptyActionDestination = groupLessonId ? "/group-lessons" : "/find-coaches";

    return (
      <MainLayout>
        <div className="booking-confirmation booking-confirmation--empty">
          <div className="booking-confirmation__empty-card">
            <h1 className="booking-confirmation__empty-title">{emptyTitle}</h1>
            <p className="booking-confirmation__empty-copy">{emptyCopy}</p>
            <button
              type="button"
              className="fc-button fc-button--primary booking-confirmation__empty-action"
              onClick={() => navigate(emptyActionDestination)}
            >
              {emptyActionLabel}
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="booking-confirmation">
        <div className="booking-confirmation__inner">
          <button
            type="button"
            className="booking-confirmation__back"
            onClick={() => {
              if (backButtonDestination) {
                navigate(backButtonDestination);
              } else {
                navigate(-1);
              }
            }}
          >
            <ArrowLeft aria-hidden className="booking-confirmation__back-icon" /> {backButtonLabel}
          </button>

          <header className="booking-confirmation__header">
            <div className="booking-confirmation__headline">
              <span className="booking-confirmation__eyebrow">Review & confirm</span>
              <h1 className="booking-confirmation__title">{confirmTitle}</h1>
              <p className="booking-confirmation__subtitle">{headlineSubtitle}</p>
            </div>
          </header>

          <div className="booking-confirmation__layout">
            <section className="booking-confirmation__card">
              <div className="booking-confirmation__coach">
                {coachAvatar ? (
                  <img className="booking-confirmation__coach-avatar" src={coachAvatar} alt="" />
                ) : (
                  <span className="booking-confirmation__coach-avatar booking-confirmation__coach-avatar--placeholder" aria-hidden>
                    {coachFirstName.charAt(0)}
                  </span>
                )}
                <div className="booking-confirmation__coach-meta">
                  <h2 className="booking-confirmation__coach-name">{coachName}</h2>
                  {coachTitle ? <p className="booking-confirmation__coach-title">{coachTitle}</p> : null}
                  {coachRating != null ? (
                    <div className="booking-confirmation__coach-rating">
                      <Star size={18} fill="#FDB022" stroke="none" aria-hidden />
                      {coachRating.toFixed(1)}
                      {coachReviewCount != null ? (
                        <span className="booking-confirmation__coach-reviews">({coachReviewCount} reviews)</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="booking-confirmation__details">
                <div className="booking-confirmation__detail">
                  <CalendarDays aria-hidden size={20} />
                  <div className="booking-confirmation__detail-copy">
                    <span className="booking-confirmation__detail-label">When</span>
                    <span className="booking-confirmation__detail-primary">{lessonDateLabel ?? "To be scheduled"}</span>
                    {timeRange ? (
                      <span className="booking-confirmation__detail-secondary">{timeRange}</span>
                    ) : null}
                  </div>
                </div>

                <div className="booking-confirmation__detail">
                  <Clock aria-hidden size={20} />
                  <div className="booking-confirmation__detail-copy">
                    <span className="booking-confirmation__detail-label">Lesson</span>
                    <span className="booking-confirmation__detail-primary">{lessonLabel}</span>
                    {durationLabel ? (
                      <span className="booking-confirmation__detail-secondary">{durationLabel}</span>
                    ) : null}
                  </div>
                </div>

                {locationLabel ? (
              <div className="booking-confirmation__detail">
                <MapPin aria-hidden size={20} />
                <div className="booking-confirmation__detail-copy">
                  <span className="booking-confirmation__detail-label">Location</span>
                  <span className="booking-confirmation__detail-primary">{locationLabel}</span>
                  {spotsLabel ? (
                    <span className="booking-confirmation__detail-secondary">{spotsLabel}</span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {isGroupLesson ? (
              <div className="booking-confirmation__group-roster">
                <div className="booking-confirmation__group-roster-header">
                  <span className="booking-confirmation__group-roster-icon" aria-hidden>
                    <Users size={18} />
                  </span>
                  <div className="booking-confirmation__group-roster-heading">
                    <span className="booking-confirmation__group-roster-label">Who's already in</span>
                    {rosterCaption ? (
                      <span className="booking-confirmation__group-roster-caption">{rosterCaption}</span>
                    ) : null}
                  </div>
                </div>

                {participantCount > 0 ? (
                  <ul className="booking-confirmation__group-roster-list">
                    {participants.map((participant) => (
                      <li key={participant.id} className="booking-confirmation__group-roster-item">
                        <span className="booking-confirmation__group-roster-avatar" aria-hidden>
                          {participant.avatarUrl ? (
                            <img src={participant.avatarUrl} alt="" />
                          ) : (
                            getInitials(participant.name)
                          )}
                        </span>
                        <div className="booking-confirmation__group-roster-body">
                          <span className="booking-confirmation__group-roster-name">{participant.name}</span>
                          <span className="booking-confirmation__group-roster-meta">
                            {participant.skillLevel ?? "Skill level pending"}
                            {participant.focusArea ? ` • ${participant.focusArea}` : ""}
                          </span>
                          {participant.joinedLabel ? (
                            <span className="booking-confirmation__group-roster-joined">{participant.joinedLabel}</span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="booking-confirmation__group-roster-empty">
                    <p>
                      You're first in line for this session. Invite a friend or grab a spot before they're gone!
                    </p>
                  </div>
                )}

                {openSpots > 0 ? (
                  <div className="booking-confirmation__group-roster-footer">
                    +{openSpots} spot{openSpots === 1 ? "" : "s"} open
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="booking-confirmation__price">
            <div>
              <span className="booking-confirmation__price-label">{priceLabel}</span>
              <span className="booking-confirmation__price-value">{priceValue}</span>
            </div>
            <span className="booking-confirmation__price-caption">{priceCaption}</span>
          </div>

          <div className="booking-confirmation__payment">
            <div className="booking-confirmation__payment-header">
              <div>
                <h3>Payment method</h3>
                <p>Choose how you’d like to take care of this lesson.</p>
              </div>
              <span className="booking-confirmation__payment-secure">
                <ShieldCheck aria-hidden size={16} /> Secure checkout
              </span>
            </div>

            <div className="payment-methods">
              {canUseCredits ? lessonCreditsSection : null}
              {savedCardsSection}
              {digitalWalletSection}
              {!canUseCredits ? lessonCreditsSection : null}
              <div className="payment-packages-banner">
                <span className="payment-packages-banner__icon">
                  <Package aria-hidden size={20} />
                </span>
                <div className="payment-packages-banner__body">
                  <h4>Need more credits?</h4>
                  <p>Lock in savings with lesson packages and top up your credit balance anytime.</p>
                </div>
                <button
                  type="button"
                  className="payment-packages-banner__action"
                  onClick={() => navigate("/find-coaches")}
                >
                  Browse packages
                </button>
              </div>
            </div>
          </div>

          <div className="booking-confirmation__actions">
            <button
              type="button"
              className="fc-button fc-button--primary booking-confirmation__confirm"
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
            >
              {confirmButtonLabel}
              <CheckCircle2 aria-hidden className="booking-confirmation__confirm-icon" />
            </button>
            <span className="booking-confirmation__disclaimer">{disclaimerCopy}</span>
                {isConfirmed && isGroupLesson ? (
                  <div
                    className={`booking-confirmation__status ${
                      isGroupLesson ? "booking-confirmation__status--success" : "booking-confirmation__status--pending"
                    }`}
                    role="status"
                    aria-live="polite"
                  >
                    <h3>{confirmationStatus.title}</h3>
                    <p>{confirmationStatus.copy}</p>
                    <button
                      type="button"
                      className="booking-confirmation__status-action"
                      onClick={() => navigate("/")}
                    >
                      Go to dashboard
                    </button>
                  </div>
                ) : null}
              </div>
            </section>

            <aside className="booking-confirmation__aside">
              <div className="booking-confirmation__aside-card">
                <h3>What happens next</h3>
                <ul>
                  {nextStepsItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="booking-confirmation__aside-card booking-confirmation__aside-card--muted">
                <h3>Need to adjust?</h3>
                <p>{adjustCopy}</p>
                <button
                  type="button"
                  className="booking-confirmation__aside-back"
                  onClick={handleAdjustNavigation}
                >
                  {adjustButtonLabel}
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>
      {isConfirmationModalOpen && !isGroupLesson ? (
        <PrivateLessonConfirmationModal
          coachName={coachName}
          coachTitle={coachTitle}
          lessonLabel={lessonLabel}
          dateLabel={lessonDateLabel}
          timeRange={timeRange}
          locationLabel={locationLabel}
          statusLabel={lessonStatusLabel}
          statusCopy={confirmationStatus.copy}
          onClose={() => setIsConfirmationModalOpen(false)}
          startDate={privateLessonStart}
          endDate={privateLessonEnd}
        />
      ) : null}
      {isConfirmationModalOpen && groupLesson ? (
        <GroupLessonConfirmationModal
          lesson={groupLesson}
          onClose={() => setIsConfirmationModalOpen(false)}
        />
      ) : null}
    </MainLayout>
  );
};

export default BookingConfirmationPage;
