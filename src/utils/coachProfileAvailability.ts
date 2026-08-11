export type CoachProfileAvailabilitySlot = {
  id: string;
  start: string;
  type?: string;
  sourceLessonId?: number;
};

export type CoachProfileAvailabilityDay<T extends CoachProfileAvailabilitySlot> = {
  isoDate: string;
  slots: T[];
};

const slotIdentity = (slot: CoachProfileAvailabilitySlot) => {
  if (slot.sourceLessonId != null) {
    return `${slot.type ?? "lesson"}:lesson:${slot.sourceLessonId}`;
  }
  return slot.id;
};

const compareSlots = (a: CoachProfileAvailabilitySlot, b: CoachProfileAvailabilitySlot) => {
  const aTime = Date.parse(a.start);
  const bTime = Date.parse(b.start);
  if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
    return aTime - bTime;
  }
  return a.id.localeCompare(b.id);
};

export const mergeAvailabilityDayGroups = <T extends CoachProfileAvailabilitySlot>(
  baseDays: Array<CoachProfileAvailabilityDay<T>>,
  additionalDays: Array<CoachProfileAvailabilityDay<T>>,
) => {
  const byDate = new Map<string, CoachProfileAvailabilityDay<T>>();

  [...baseDays, ...additionalDays].forEach((day) => {
    const existing = byDate.get(day.isoDate);
    if (!existing) {
      byDate.set(day.isoDate, { ...day, slots: [...day.slots].sort(compareSlots) });
      return;
    }

    const seen = new Set(existing.slots.map(slotIdentity));
    const nextSlots = [...existing.slots];
    day.slots.forEach((slot) => {
      const key = slotIdentity(slot);
      if (seen.has(key)) return;
      seen.add(key);
      nextSlots.push(slot);
    });
    byDate.set(day.isoDate, { ...existing, slots: nextSlots.sort(compareSlots) });
  });

  return Array.from(byDate.values()).sort((a, b) => a.isoDate.localeCompare(b.isoDate));
};

export const isCancelledLessonStatus = (status: unknown) => {
  if (typeof status === "number") return status === 2;
  if (typeof status === "string") {
    const normalized = status.trim().toLowerCase();
    return normalized === "2" || normalized === "cancelled" || normalized === "canceled";
  }
  return false;
};
