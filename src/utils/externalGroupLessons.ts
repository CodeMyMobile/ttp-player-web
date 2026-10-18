// Outside providers' lessons, mapped into the GroupLesson shape. Shared by the Group
// Lessons page and the league dashboard's lesson prompts so both read them the same way.

import moment from "moment";

import { normalizeLevel, type GroupLesson } from "../api/groupLessons";
import type { PlayerExternalLesson } from "../api/playerHome";

export const extractExternalLessons = (response: unknown): PlayerExternalLesson[] => {
  if (!response || typeof response !== "object") return [];
  const record = response as Record<string, unknown>;
  if (Array.isArray(record.data)) return record.data as PlayerExternalLesson[];
  if (Array.isArray(record.lessons)) return record.lessons as PlayerExternalLesson[];
  if (Array.isArray(record.results)) return record.results as PlayerExternalLesson[];
  if (Array.isArray(record.items)) return record.items as PlayerExternalLesson[];
  return [];
};

export const getExternalLessonMetadata = (lesson: PlayerExternalLesson) => {
  const metadata = lesson.metadata && typeof lesson.metadata === "object"
    ? lesson.metadata as Record<string, unknown>
    : {};
  return {
    title: typeof metadata.title === "string" ? metadata.title : undefined,
    level: typeof metadata.level === "string" ? metadata.level : undefined,
    description: typeof metadata.description === "string" ? metadata.description : undefined,
    externalUrl: typeof metadata.externalUrl === "string" ? metadata.externalUrl : undefined,
  };
};

export const mapExternalLessonToGroupLesson = (lesson: PlayerExternalLesson): GroupLesson => {
  const metadata = getExternalLessonMetadata(lesson);
  // The CMS stores the external lesson's level on the top-level `level` field
  // (e.g. "4.5"), NOT in metadata.level (which is undefined for external lessons).
  const rawLevel = (lesson as Record<string, unknown>).level ?? metadata.level;
  const start = lesson.start_date_time ? new Date(String(lesson.start_date_time)) : null;
  const end = lesson.end_date_time ? new Date(String(lesson.end_date_time)) : null;
  const durationMinutes =
    start && end && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())
      ? Math.max(Math.round((end.getTime() - start.getTime()) / 60000), 0)
      : 60;
  const locationName =
    typeof lesson.location === "string" && lesson.location.trim()
      ? lesson.location
      : "Location TBD";
  const fullName = typeof lesson.full_name === "string" && lesson.full_name.trim()
    ? lesson.full_name
    : "External provider";
  const dateLabels = lesson.start_date_time
    ? {
        day: moment.utc(String(lesson.start_date_time)).format("dddd"),
        date: moment.utc(String(lesson.start_date_time)).format("MMM D"),
        startTime: moment.utc(String(lesson.start_date_time)).format("h:mm A"),
      }
    : { day: "TBD", date: "Date TBD", startTime: "Time TBD" };

  return {
    id: String(lesson.id),
    title: metadata.title || String(lesson.lesson_type_name ?? "External lesson"),
    coachId: 0,
    coachName: fullName,
    coachAvatarUrl: typeof lesson.profile_picture === "string" ? lesson.profile_picture : "",
    // normalizeLevel reads a string or number and returns null for anything else.
    level: normalizeLevel(rawLevel as string | number | undefined),
    skillLabel: rawLevel != null && String(rawLevel).trim() !== "" ? String(rawLevel) : "All levels",
    description: metadata.description || "Booking is completed through the provider.",
    day: dateLabels.day,
    date: dateLabels.date,
    startTime: dateLabels.startTime,
    startDateTime: typeof lesson.start_date_time === "string" ? lesson.start_date_time : undefined,
    endDateTime: typeof lesson.end_date_time === "string" ? lesson.end_date_time : undefined,
    locationName,
    locationCity: locationName,
    distanceMiles: 0,
    totalSpots: 0,
    availableSpots: 1,
    cancelled: false,
    focus: typeof lesson.lesson_type_name === "string" ? lesson.lesson_type_name : "External",
    durationMinutes,
    pricePerPlayer: "External booking",
    participants: [],
    groupPlayers: [],
    isExternal: true,
    externalUrl: metadata.externalUrl,
    sourceLesson: lesson,
  };
};
