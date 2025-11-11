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

const sanitizeQuery = <T extends Record<string, unknown>>(params: T) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  ) as T;

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

export const bookLesson = ({ token, lessonId }: BookLessonParams) =>
  request(`/player/lessons/${lessonId}/book`, {
    method: "POST",
    token,
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
