import { request } from "./http";

export interface LessonMetadata {
  title?: string;
  level?: string;
  description?: string;
  recurrence?: {
    frequency: "NONE" | "DAILY" | "WEEKLY" | (string & {});
    count?: number;
  };
}

export interface Lesson {
  id: number;
  coach_id: number;
  coach_name: string;
  location_id: number;
  location_name?: string;
  start_date_time: string;
  end_date_time: string;
  player_limit?: number;
  current_player_count?: number;
  metadata?: LessonMetadata;
  metadata_title?: string;
  metadata_level?: string;
  price_per_person?: number;
  lesson_type_name?: string;
  player_has_booking?: boolean;
}

export interface CoachScheduleEntry {
  id?: number;
  user_id?: number;
  coach_id?: number;
  from?: string;
  to?: string;
  day?: string;
  location_id?: number;
  location_name?: string;
  location?: string;
  court?: string | number | null;
  latitude?: string;
  longitude?: string;
  [key: string]: unknown;
}

const sanitizeQuery = <T extends Record<string, unknown>>(params: T) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  ) as T;

type CoachScheduleCollection = {
  data?: CoachScheduleEntry[];
  results?: CoachScheduleEntry[];
  items?: CoachScheduleEntry[];
  schedule?: CoachScheduleEntry[];
  schedules?: CoachScheduleEntry[];
};

type CoachScheduleResponse = CoachScheduleEntry[] | CoachScheduleCollection | null | undefined;

const coachScheduleKeys: Array<keyof CoachScheduleCollection> = ["data", "results", "items", "schedule", "schedules"];

const extractCoachScheduleEntries = (payload: CoachScheduleResponse): CoachScheduleEntry[] => {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  for (const key of coachScheduleKeys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
};

export interface FetchAvailableLessonsParams {
  token: string;
  start_date: string;
  end_date: string;
  search?: string;
  coach_id?: number;
  level?: string;
  location_id?: number;
}

export const fetchAvailableLessons = ({
  token,
  ...query
}: FetchAvailableLessonsParams) =>
  request<{ data: Lesson[] }>("/player/lessons/available", {
    token,
    query: sanitizeQuery(query),
  });

export interface FetchCoachScheduleParams {
  token: string;
  coachId: number | string;
  day?: string;
}

export const fetchCoachSchedule = async ({ token, coachId, day }: FetchCoachScheduleParams) => {
  const response = await request<CoachScheduleResponse>(`/player/coach/schedule/${coachId}`, {
    token,
    query: day ? { day } : undefined,
  });
  return extractCoachScheduleEntries(response);
};

export interface FetchCoachLessonsByDateParams {
  token?: string;
  coachId: number | string;
  date: string;
}

export const fetchCoachLessonsByDate = async ({ token, coachId, date }: FetchCoachLessonsByDateParams) => {
  if (!coachId || !date) {
    return [];
  }

  try {
    const response = await request<Lesson[]>(`/player/coach/lessons/date/${coachId}`, {
      token,
      query: { date },
    });

    if (!response) {
      return [];
    }

    return Array.isArray(response) ? response : [];
  } catch (error) {
    const status = (error as Error & { status?: number })?.status;
    if (status === 404) {
      return [];
    }
    throw error;
  }
};

export interface FetchPlayerBookingsParams {
  token: string;
}

export const fetchPlayerBookings = ({ token }: FetchPlayerBookingsParams) =>
  request<{ data: number[] }>("/player/lessons/bookings", {
    token,
  });

export interface BookLessonParams {
  token: string;
  lessonId: number;
}

export interface FetchPlayerLessonByIdParams {
  token: string;
  lessonId: number | string;
  signal?: AbortSignal;
}

export const fetchPlayerLessonById = ({ token, lessonId, signal }: FetchPlayerLessonByIdParams) =>
  request<Lesson | { lesson?: Lesson }>(`/player/lesson/${lessonId}`, {
    token,
    signal,
  });

export const bookLesson = ({ token, lessonId }: BookLessonParams) =>
  request(`/player/lessons/${lessonId}/book`, {
    method: "POST",
    token,
  });

export interface JoinLessonParams {
  token: string;
  lessonId: number | string;
  coachId: number | string;
  startDateTime: string;
  endDateTime: string;
  startDateTimeTz: string;
  endDateTimeTz: string;
  locationId: number | string;
  court?: number | string | null;
  status: string;
  paymentMethodId?: string;
}

export interface BookGroupLessonWithCardParams {
  token: string;
  lessonId: number | string;
  paymentMethodId: string;
}

export const joinLesson = ({
  token,
  lessonId,
  coachId,
  startDateTime,
  endDateTime,
  startDateTimeTz,
  endDateTimeTz,
  locationId,
  court = 0,
  status,
  paymentMethodId,
}: JoinLessonParams) =>
  request(`/player/lesson/${lessonId}/book`, {
    method: "POST",
    token,
    body: {
      location_id: locationId,
      coach_id: coachId,
      start_date_time: startDateTime,
      end_date_time: endDateTime,
      start_date_time_tz: startDateTimeTz,
      end_date_time_tz: endDateTimeTz,
      status,
      court,
      ...(paymentMethodId ? { payment_method_id: paymentMethodId } : {}),
    },
  });

export const bookGroupLessonWithCard = ({ token, lessonId, paymentMethodId }: BookGroupLessonWithCardParams) =>
  request(`/player/lesson/${lessonId}/book`, {
    method: "POST",
    token,
    authScheme: "Token",
    body: {
      payment_method_id: paymentMethodId,
    },
  });

export interface CancelLessonBookingParams {
  token: string;
  lessonId: number;
}

export const cancelBooking = ({ token, lessonId }: CancelLessonBookingParams) =>
  request(`/player/lessons/${lessonId}/book`, {
    method: "DELETE",
    token,
  });

export interface RequestPrivateLessonParams {
  token: string;
  coachId: number;
  startDateTime: string;
  endDateTime: string;
  startDateTimeTz: string;
  endDateTimeTz: string;
  locationId: number;
  court?: number | string | null;
  status?: string;
  paymentMethodId?: string;
  metadata?: {
    session_prep?: {
      who_for?: "myself" | "my_child";
      level?: "Beginner" | "Beginner+" | "Intermediate" | "Intermediate+" | "Advanced" | "Competitive";
      goals?: string[];
      note?: string;
    };
  };
}

export interface NewLessonResponse {
  id?: number | string;
  lesson_id?: number | string;
  lesson?: {
    id?: number | string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export const requestPrivateLesson = ({
  token,
  coachId,
  startDateTime,
  endDateTime,
  startDateTimeTz,
  endDateTimeTz,
  locationId,
  court = 0,
  status = "PENDING",
  paymentMethodId,
  metadata,
}: RequestPrivateLessonParams) =>
  request<NewLessonResponse>("/player/newlesson", {
    method: "POST",
    token,
    body: {
      coach_id: coachId,
      start_date_time: startDateTime,
      end_date_time: endDateTime,
      start_date_time_tz: startDateTimeTz,
      end_date_time_tz: endDateTimeTz,
      location_id: locationId,
      court,
      status,
      ...(paymentMethodId ? { payment_method_id: paymentMethodId } : {}),
      ...(metadata ? { metadata } : {}),
    },
  });
