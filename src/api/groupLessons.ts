import moment from "moment";

import { request } from "./http";

export type GroupLessonLevel = 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5 | 5.5 | 6;

export interface GroupLesson {
  id: string;
  title: string;
  coachId: number;
  coachName: string;
  coachAvatarUrl: string;
  level: GroupLessonLevel | null;
  skillLabel: string;
  description: string;
  day: string;
  date: string;
  startTime: string;
  startDateTime?: string;
  endDateTime?: string;
  locationId?: number;
  court?: number | string | null;
  durationMinutes: number;
  locationName: string;
  locationCity: string;
  distanceMiles: number;
  totalSpots: number;
  availableSpots: number;
  focus: string;
  courtSurface?: string;
  pricePerPlayer: string;
  isExternal?: boolean;
  externalUrl?: string;
  sourceLesson?: unknown;
  participants: Array<{
    id: string;
    name: string;
    skillLevel?: string;
    focusArea?: string;
    joinedLabel?: string;
    avatarUrl?: string;
    paymentStatus?: number;
    status?: number;
  }>;
  groupPlayers?: Array<{
    id?: number | string;
    participantId?: number | string;
    playerId?: number | string;
    name?: string;
    avatarUrl?: string;
    email?: string;
    phone?: string;
    paymentStatus?: number;
    status?: number;
  }>;
  highlights?: string[];
}

export interface GroupLessonsResponse {
  lessons: GroupLesson[];
  meta?: Record<string, unknown>;
}

export interface UpcomingGroupLessonPlayerApi {
  id?: number | string;
  participant_id?: number | string;
  player_id?: number | string;
  full_name?: string;
  profile_picture?: string;
  payment_status?: number;
  status?: number;
  [key: string]: unknown;
}

export interface UpcomingGroupLessonApi {
  id: number | string;
  lesson_id?: number | string | null;
  occurrence_id?: string | null;
  group_class_id?: number | string | null;
  full_name?: string;
  coach_id?: number;
  profile_picture?: string;
  start_date_time?: string;
  end_date_time?: string;
  location?: string;
  location_city?: string;
  latitude?: string | number;
  longitude?: string | number;
  player_limit?: number;
  booked_count?: number;
  open_spots?: number;
  group_players?: UpcomingGroupLessonPlayerApi[];
  metadata?: {
    level?: string;
    title?: string;
    duration?: string | number;
    description?: string;
  };
  group_price_per_person?: string | number;
  lesson_type_name?: string;
  distance_miles?: number;
  distanceMiles?: number;
  [key: string]: unknown;
}

export interface UpcomingGroupLessonsApiResponse {
  lessons: UpcomingGroupLessonApi[];
  meta?: Record<string, unknown>;
}

export interface GroupLessonsFilters {
  coachId?: number;
  level?: string | number;
  radius?: number;
  dateStart?: string;
  dateEnd?: string;
  q?: string;
}

export interface GroupLessonsPosition {
  latitude: number;
  longitude: number;
}

export interface FetchUpcomingGroupLessonsParams {
  token?: string;
  perPage?: number;
  page?: number;
  search?: string;
  position?: GroupLessonsPosition;
  filters?: GroupLessonsFilters;
  signal?: AbortSignal;
}

const buildRequestBody = <T extends Record<string, unknown>>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as T;

const isDateOnlyValue = (value?: string) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

const normalizeFilterDate = (value: string | undefined, boundary: "start" | "end") => {
  if (!value) {
    return value;
  }

  if (!isDateOnlyValue(value)) {
    return value;
  }

  const parsed = moment.utc(value, "YYYY-MM-DD", true);
  if (!parsed.isValid()) {
    return value;
  }

  return (boundary === "start" ? parsed.startOf("day") : parsed.endOf("day")).toISOString();
};

const normalizeGroupLessonFilters = (filters?: GroupLessonsFilters) => {
  if (!filters) {
    return filters;
  }

  return buildRequestBody({
    ...filters,
    dateStart: normalizeFilterDate(filters.dateStart, "start"),
    dateEnd: normalizeFilterDate(filters.dateEnd, "end"),
  });
};

// Returns the class's real NTRP level, or null when it is unset / "All" /
// non-numeric. The API sends labeled levels like "Beginner (NTRP 2.5)", so we
// extract the first embedded number rather than parseFloat-ing the whole label
// (which reads as NaN). Returns null only when there's truly no digit — "All",
// empty, or lesson-type fallbacks like "Open Group" — so the UI can show
// "All levels" instead of inventing a range.
const normalizeLevel = (level?: string | number): GroupLessonLevel | null => {
  if (level !== undefined && level !== null) {
    const match = String(level).match(/\d+(?:\.\d+)?/);
    if (match) {
      const parsed = Number.parseFloat(match[0]);
      if (Number.isFinite(parsed)) {
        const rounded = Math.round(parsed * 2) / 2;
        const clamped = Math.min(6, Math.max(2, rounded));
        return clamped as GroupLessonLevel;
      }
    }
  }
  return null;
};

const parseDurationMinutes = (lesson: UpcomingGroupLessonApi) => {
  const metadataDuration = lesson.metadata?.duration;
  const durationFromMetadata =
    metadataDuration !== undefined && metadataDuration !== null
      ? Number.parseInt(String(metadataDuration), 10)
      : null;
  if (durationFromMetadata && Number.isFinite(durationFromMetadata)) {
    return durationFromMetadata;
  }
  if (lesson.start_date_time && lesson.end_date_time) {
    const diff = moment(lesson.end_date_time).diff(moment(lesson.start_date_time), "minutes");
    if (Number.isFinite(diff) && diff > 0) {
      return diff;
    }
  }
  return 60;
};

const buildDateLabels = (startDateTime?: string) => {
  if (!startDateTime) {
    return { day: "TBD", date: "Date TBD", startTime: "Time TBD" };
  }
  const startMoment = moment.utc(startDateTime);
  return {
    day: startMoment.format("dddd"),
    date: startMoment.format("MMM D"),
    startTime: startMoment.format("h:mm A"),
  };
};

const formatPricePerPlayer = (value?: string | number) => {
  if (value === undefined || value === null || value === "") {
    return "Price unavailable";
  }
  const trimmed = String(value).trim();
  if (trimmed.startsWith("$")) {
    return `${trimmed} per player`;
  }
  return `$${trimmed} per player`;
};

const extractCityState = (location?: string) => {
  if (!location) return "";
  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const city = parts[parts.length - 3];
    const stateSegment = parts[parts.length - 2];
    const state = stateSegment.split(/\s+/)[0];
    if (city && state) {
      return `${city}, ${state}`;
    }
  }
  return parts.slice(-2).join(", ");
};

const parseStatusValue = (value?: number | string | null) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const isActiveGroupLessonBookingStatus = (
  status?: number | string | null,
  paymentStatus?: number | string | null,
) => {
  const numericStatus = parseStatusValue(status);
  const numericPaymentStatus = parseStatusValue(paymentStatus);
  return numericStatus === 1 && numericPaymentStatus === 1;
};

export const isActiveGroupLessonPlayer = (player: {
  status?: number | string | null;
  paymentStatus?: number | string | null;
  payment_status?: number | string | null;
}) => {
  return isActiveGroupLessonBookingStatus(
    player.status,
    player.paymentStatus ?? player.payment_status,
  );
};

export const mapUpcomingGroupLesson = (lesson: UpcomingGroupLessonApi): GroupLesson => {
  const { day, date, startTime } = buildDateLabels(lesson.start_date_time);
  const normalizedGroupPlayers = (lesson.group_players ?? []).map((player) => {
    const paymentStatus =
      typeof player.payment_status === "number"
        ? player.payment_status
        : Number(player.payment_status);
    const status =
      typeof player.status === "number"
        ? player.status
        : Number(player.status);

    return {
      id: player.id,
      participantId: player.participant_id ?? player.id,
      playerId: player.player_id,
      name: player.full_name ?? "Player",
      avatarUrl: player.profile_picture,
      email: typeof player.email === "string" ? player.email.toLowerCase() : undefined,
      phone: typeof player.phone === "string" ? player.phone : undefined,
      paymentStatus: Number.isFinite(paymentStatus) ? paymentStatus : undefined,
      status: Number.isFinite(status) ? status : undefined,
    };
  });
  const activeGroupPlayers = normalizedGroupPlayers.filter(isActiveGroupLessonPlayer);
  const totalSpots = lesson.player_limit ?? normalizedGroupPlayers.length ?? 0;
  const bookedCountRaw = typeof lesson.booked_count === "number" ? lesson.booked_count : Number(lesson.booked_count);
  const openSpotsRaw = typeof lesson.open_spots === "number" ? lesson.open_spots : Number(lesson.open_spots);
  const confirmedCount = Number.isFinite(bookedCountRaw) ? bookedCountRaw : activeGroupPlayers.length;
  const availableSpots = Number.isFinite(openSpotsRaw) ? Math.max(openSpotsRaw, 0) : Math.max(totalSpots - confirmedCount, 0);
  const locationCity = lesson.location_city || extractCityState(lesson.location);
  const distanceMiles = Number.isFinite(lesson.distance_miles)
    ? (lesson.distance_miles as number)
    : Number.isFinite(lesson.distanceMiles)
      ? (lesson.distanceMiles as number)
      : 0;
  const skillLabel = lesson.metadata?.level && lesson.metadata.level !== "All"
    ? lesson.metadata.level
    : lesson.lesson_type_name ?? "All levels";
  const title = lesson.metadata?.title || "Group lesson";
  const description = lesson.metadata?.description || "Details coming soon.";

  return {
    id: String(lesson.id),
    title,
    coachId: lesson.coach_id ?? 0,
    coachName: lesson.full_name ?? "Coach",
    coachAvatarUrl: lesson.profile_picture ?? "",
    level: normalizeLevel(lesson.metadata?.level),
    skillLabel,
    description,
    day,
    date,
    startTime,
    startDateTime: lesson.start_date_time,
    endDateTime: lesson.end_date_time,
    locationId: (() => {
      const raw = lesson.location_id;
      const numeric = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(numeric) ? numeric : undefined;
    })(),
    court: lesson.court ?? null,
    durationMinutes: parseDurationMinutes(lesson),
    locationName: lesson.location ?? "Location TBD",
    locationCity: locationCity || "Location TBD",
    distanceMiles,
    totalSpots,
    availableSpots,
    focus: lesson.lesson_type_name ?? description,
    pricePerPlayer: formatPricePerPlayer(lesson.group_price_per_person),
    sourceLesson: lesson,
    participants: activeGroupPlayers.map((player, index) => ({
      id: String(player.playerId ?? `${lesson.id}-${index}`),
      name: player.name,
      avatarUrl: player.avatarUrl,
      paymentStatus: player.paymentStatus,
      status: player.status,
    })),
    groupPlayers: normalizedGroupPlayers,
  };
};

export const mapUpcomingGroupLessonsResponse = (
  response: UpcomingGroupLessonsApiResponse,
): GroupLessonsResponse => ({
  lessons: response.lessons.map(mapUpcomingGroupLesson),
  meta: response.meta,
});

export const fetchUpcomingGroupLessons = ({
  token,
  perPage,
  page,
  search,
  position,
  filters,
  signal,
}: FetchUpcomingGroupLessonsParams) =>
  request<UpcomingGroupLessonsApiResponse>("/player/upcoming_group_lessons", {
    method: "POST",
    token,
    signal,
    query: {
      perPage,
      page,
    },
    body: buildRequestBody({
      search,
      position,
      filters: normalizeGroupLessonFilters(filters),
    }),
  });

export interface FetchUpcomingGroupLessonByIdParams {
  token?: string;
  lessonId: number | string;
  signal?: AbortSignal;
}

export interface UpcomingGroupLessonByIdResponse {
  lesson: UpcomingGroupLessonApi;
}

export const fetchUpcomingGroupLessonById = ({
  token,
  lessonId,
  signal,
}: FetchUpcomingGroupLessonByIdParams) =>
  request<UpcomingGroupLessonByIdResponse>(`/player/upcoming_group_lessons/${lessonId}`, {
    token,
    signal,
  });
