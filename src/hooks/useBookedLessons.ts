import { useEffect, useState } from "react";

import { getPlayerPastLessons } from "../api/playerHome";
import { isActiveGroupLessonBookingStatus } from "../api/groupLessons";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";

export interface BookedLesson {
  id: number | string;
  title: string;
  coachName: string;
  startDateTime?: string;
  pricePerPerson?: string | number | null;
}

// The current player's id/email, used to find their own entry inside a lesson's
// group_players[] array.
const readMe = (): { id: number | null; email: string } => {
  try {
    const raw = localStorage.getItem("playerPersonalDetails");
    const details = raw ? JSON.parse(raw) : null;
    const id = details?.id != null ? Number(details.id) : null;
    return {
      id: Number.isFinite(id) ? id : null,
      email: String(details?.email ?? "").toLowerCase(),
    };
  } catch {
    return { id: null, email: "" };
  }
};

export interface UseBookedLessonsResult {
  lessons: BookedLesson[];
  loading: boolean;
  error: string | null;
}

// Read-only history of the group lessons the player has actually booked (their
// group_players entry is an active/confirmed booking). Sourced from /player/past_lessons
// — records are keyed by lesson, so we pick out the current player's own participation.
// Framed as bookings, NOT spend: pricePerPerson is the lesson's list price, and lessons
// may have been paid with a package credit, so this is intentionally kept separate from
// the package "purchases" list to avoid double-counting.
export const useBookedLessons = (): UseBookedLessonsResult => {
  const { user } = useAuth();
  const token =
    user?.session?.access_token ??
    user?.access_token ??
    user?.token ??
    getStoredAuthToken({ preferScheme: "Token" }) ??
    getStoredAuthToken({ preferScheme: "token" }) ??
    undefined;

  const [lessons, setLessons] = useState<BookedLesson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const me = readMe();
    getPlayerPastLessons({ token, page: 1, perPage: 100, signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        const raw = res as Record<string, unknown>;
        const list = (raw?.lessons ?? raw?.data ?? []) as Array<Record<string, unknown>>;
        const mine: BookedLesson[] = [];
        for (const lesson of Array.isArray(list) ? list : []) {
          const players = (lesson.group_players as Array<Record<string, unknown>>) ?? [];
          const entry = players.find((gp) => {
            const pid = Number(gp.player_id);
            return (
              (me.id != null && pid === me.id) ||
              (me.email !== "" && String(gp.email ?? "").toLowerCase() === me.email)
            );
          });
          if (!entry) continue;
          // Keep only active/confirmed bookings (skips cancelled/pending).
          if (!isActiveGroupLessonBookingStatus(entry.status, entry.payment_status)) continue;
          const meta = (lesson.metadata as Record<string, unknown>) ?? {};
          mine.push({
            id: (lesson.id as number | string) ?? `${mine.length}`,
            title: String(meta.title ?? lesson.lesson_type_name ?? "Group lesson"),
            coachName: String(lesson.full_name ?? "").trim(),
            startDateTime: (lesson.start_date_time as string) ?? undefined,
            pricePerPerson: (lesson.group_price_per_person as string) ?? null,
          });
        }
        mine.sort(
          (a, b) =>
            new Date(b.startDateTime ?? 0).getTime() - new Date(a.startDateTime ?? 0).getTime(),
        );
        setLessons(mine);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Couldn't load your booked lessons.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token]);

  return { lessons, loading, error };
};

export default useBookedLessons;
