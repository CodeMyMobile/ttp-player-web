import type { CSSProperties } from "react";
import { ChevronRight, MapPin, Moon, Sun, Sunrise, type LucideIcon } from "lucide-react";

import { getAvailabilitySlotPeriod, type CoachProfileAvailabilityPeriod } from "../../utils/coachProfileAvailability";
import "./BookingSlotList.css";

/**
 * Minimal shape the slot list needs. `LoadedSlot` (CoachProfilePage) is structurally a superset,
 * so it can be passed directly; the component is generic so `onSelectSlot` hands back the exact
 * object reference the caller provided.
 */
export interface BookingSlotItem {
  id: string;
  type: "private" | "group";
  isoDate: string;
  dayLabel: string;
  dateLabel: string;
  timeLabel: string;
  durationLabel: string;
  court: string;
  priceLabel: string;
  start: string;
  className?: string;
  level?: string;
  spotsLeft?: number;
  totalSpots?: number;
}

export type SlotBookingState = "pending" | "confirmed" | null | undefined;

interface BookingSlotListProps<T extends BookingSlotItem> {
  /** Slots to render. May span one day (a selected date) or several ("All dates"). */
  slots: T[];
  /** Show the per-row PRIVATE/GROUP badge — true only when the All tab is active. */
  showTypeBadge: boolean;
  /** Called when a tappable slot is selected; receives the original slot object. */
  onSelectSlot: (slot: T) => void;
  /** Optional per-slot booking state; "pending"/"confirmed" makes the row non-interactive. */
  resolveBookingState?: (slot: T) => SlotBookingState;
}

type Period = CoachProfileAvailabilityPeriod;

const PERIODS: Array<{ key: Period; label: string; Icon: LucideIcon }> = [
  { key: "morning", label: "Morning", Icon: Sunrise },
  { key: "afternoon", label: "Afternoon", Icon: Sun },
  { key: "evening", label: "Evening", Icon: Moon },
];

// Quiet per-period identity: time-pill tint / text and the row's left-border accent.
const PERIOD_COLORS: Record<Period, { tint: string; text: string; accent: string }> = {
  morning: { tint: "#FAEEDA", text: "#854F0B", accent: "#EF9F27" },
  afternoon: { tint: "#E6F1FB", text: "#185FA5", accent: "#378ADD" },
  evening: { tint: "#EDE9FE", text: "#6D28D9", accent: "#8B5CF6" },
};

// hour < 12 → morning; 12 ≤ hour < 17 → afternoon (noon lands here); hour ≥ 17 → evening (5pm lands here).
export const periodOfSlot = (slot: BookingSlotItem): Period => {
  return getAvailabilitySlotPeriod(slot.timeLabel);
};

function BookingSlotList<T extends BookingSlotItem>({
  slots,
  showTypeBadge,
  onSelectSlot,
  resolveBookingState,
}: BookingSlotListProps<T>) {
  // Group by day (stable order) so period bucketing is always within a single day.
  const dayGroups: Array<{ isoDate: string; dayLabel: string; dateLabel: string; slots: T[] }> = [];
  for (const slot of slots) {
    let group = dayGroups.find((entry) => entry.isoDate === slot.isoDate);
    if (!group) {
      group = { isoDate: slot.isoDate, dayLabel: slot.dayLabel, dateLabel: slot.dateLabel, slots: [] };
      dayGroups.push(group);
    }
    group.slots.push(slot);
  }
  const multiDay = dayGroups.length > 1;

  return (
    <div className="bsl">
      {dayGroups.map((day) => (
        <div key={day.isoDate} className="bsl-day">
          {multiDay ? (
            <div className="bsl-day-head">
              {day.dayLabel} {day.dateLabel}
            </div>
          ) : null}

          {PERIODS.map(({ key, label, Icon }) => {
            const bucket = day.slots.filter((slot) => periodOfSlot(slot) === key);
            if (!bucket.length) return null;

            // Hoist an attribute to the section header only when it's uniform AND truthy.
            const uniformValue = (field: "court" | "durationLabel" | "priceLabel"): string | null => {
              const first = bucket[0][field];
              if (!bucket.every((slot) => slot[field] === first)) return null;
              const value = (first ?? "").toString().trim();
              return value || null;
            };
            const hoistedCourt = uniformValue("court");
            const hoistedDuration = uniformValue("durationLabel");
            const hoistedPrice = uniformValue("priceLabel");
            const headerContext = [hoistedCourt, hoistedDuration, hoistedPrice].filter(Boolean).join(" · ");

            const colors = PERIOD_COLORS[key];
            const periodStyle = {
              "--per-tint": colors.tint,
              "--per-text": colors.text,
              "--per-accent": colors.accent,
            } as CSSProperties;

            return (
              <section key={key} className="bsl-bucket" style={periodStyle}>
                <div className="bsl-bucket-head">
                  <span className="bsl-bucket-title">
                    <span className="bsl-bucket-ico">
                      <Icon size={15} strokeWidth={1.9} />
                    </span>
                    {label.toUpperCase()} <span className="bsl-bucket-cnt">· {bucket.length}</span>
                  </span>
                  {headerContext ? <span className="bsl-bucket-ctx">{headerContext}</span> : null}
                </div>

                <div className="bsl-rows">
                  {bucket.map((slot) => {
                    const state = resolveBookingState?.(slot) ?? null;
                    const isBooked = state === "pending" || state === "confirmed";
                    const statusLabel = state === "pending" ? "Requested" : state === "confirmed" ? "Booked" : null;
                    const isGroup = slot.type === "group";
                    const showSpots =
                      isGroup && slot.spotsLeft != null && slot.totalSpots != null;
                    const spotsText = showSpots
                      ? slot.spotsLeft === 0
                        ? "Full"
                        : `${slot.spotsLeft} of ${slot.totalSpots} spots left`
                      : null;
                    const perRowLocation = !hoistedCourt && slot.court?.trim() ? slot.court : null;
                    const perRowDuration =
                      !hoistedDuration && slot.durationLabel?.trim() ? slot.durationLabel : null;
                    const perRowPrice = !hoistedPrice && slot.priceLabel?.trim() ? slot.priceLabel : null;

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        className={`bsl-row bsl-row--${slot.type}${isBooked ? " is-booked" : ""}`}
                        style={periodStyle}
                        disabled={isBooked}
                        onClick={isBooked ? undefined : () => onSelectSlot(slot)}
                      >
                        <span className="bsl-time">{slot.timeLabel}</span>

                        <span className="bsl-sub">
                          {statusLabel ? (
                            <span className="bsl-badge bsl-badge--status">{statusLabel}</span>
                          ) : null}
                          {showTypeBadge ? (
                            <span className={`bsl-badge bsl-badge--${slot.type}`}>
                              {isGroup ? "GROUP" : "PRIVATE"}
                            </span>
                          ) : null}
                          {perRowLocation ? (
                            <span className="bsl-loc">
                              <MapPin size={13} />
                              {perRowLocation}
                            </span>
                          ) : null}
                          {isGroup ? (
                            <span className="bsl-grp">
                              {slot.className}
                              {slot.level ? ` · ${slot.level}` : ""}
                            </span>
                          ) : null}
                          {spotsText ? <span className="bsl-spots">{spotsText}</span> : null}
                        </span>

                        <span className="bsl-right">
                          {perRowPrice || perRowDuration ? (
                            <span className="bsl-trail">
                              {perRowPrice ? <span className="bsl-price">{perRowPrice}</span> : null}
                              {perRowDuration ? <span className="bsl-dur">{perRowDuration}</span> : null}
                            </span>
                          ) : null}
                          {isBooked ? null : <ChevronRight size={18} className="bsl-chev" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default BookingSlotList;
