import type { Lesson } from "./playerLessons";
import apiRequest from "../utils/apiRequest";

export interface PlayerCoach {
  id: number;
  coach_name?: string;
  full_name?: string;
  firstName?: string;
  lastName?: string;
  [key: string]: unknown;
}

export interface CoachLocation {
  id: number;
  name?: string;
  location?: string;
  location_name?: string;
  label?: string;
  court_name?: string;
  [key: string]: unknown;
}

export interface CoachScheduleEntry {
  id?: number;
  coach_id?: number;
  day?: string;
  from: string;
  to: string;
  location_id?: number;
  location_name?: string;
  location?: string;
  court?: string;
  [key: string]: unknown;
}

export interface PlayerCoachListResponse {
  data?: PlayerCoach[];
  results?: PlayerCoach[];
  coaches?: PlayerCoach[];
  items?: PlayerCoach[];
  [key: string]: unknown;
}

export interface GetPlayerCoachesParams {
  perPage?: number;
  page?: number;
  search?: string;
  location?: string;
}

export interface GetCoachLocationsParams {
  page?: number;
  limit?: number;
}

export interface CoachScheduleParams {
  coachId: number;
  day: string;
}

export interface CoachScheduleByLocationParams extends CoachScheduleParams {
  locationId: number;
}

export interface CoachLessonsByDateParams {
  coachId: number;
  date: string;
}

export interface GoogleCalendarEvent {
  id?: string | number;
  start?: string | { dateTime?: string; date?: string };
  end?: string | { dateTime?: string; date?: string };
  start_time?: string;
  end_time?: string;
  start_date_time?: string;
  end_date_time?: string;
  startDateTime?: string;
  endDateTime?: string;
  [key: string]: unknown;
}

export interface GetCoachGoogleCalendarEventsParams {
  coachId: number;
  timeMin: string;
  timeMax: string;
}

const safeJson = async <T>(response: Response): Promise<T | null> => {
  if (response.status === 204) {
    return null;
  }
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

const extractArray = <T>(payload: unknown, preferredKeys: string[] = ["data", "results", "items"]): T[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as T[];
  if (typeof payload === "object") {
    for (const key of preferredKeys) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        return value as T[];
      }
    }
  }
  return [];
};

export const getPlayerCoaches = async ({
  perPage = 5,
  page = 1,
  search = "",
  location = "",
}: GetPlayerCoachesParams = {}) => {
  const queryParams = new URLSearchParams({
    perPage: String(perPage),
    page: String(page),
    search,
    locationSearch: location,
  }).toString();

  const response = await apiRequest(`/player/coaches?${queryParams}`, {
    method: "GET",
  });

  if (!response?.ok) {
    throw new Error("Failed to fetch player coaches");
  }

  const json = await safeJson<PlayerCoachListResponse>(response);
  return extractArray<PlayerCoach>(json, ["data", "results", "coaches", "items"]);
};

export const getCoachLocation = async ({ page = 1, limit = 25 }: GetCoachLocationsParams = {}) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  }).toString();

  const response = await apiRequest(`/player/locations?${params}`, {
    method: "GET",
  });

  if (!response?.ok) {
    throw new Error("Failed to fetch coach locations");
  }

  const json = await safeJson<Record<string, unknown>>(response);
  return extractArray<CoachLocation>(json, ["data", "results", "items", "locations"]);
};

export const getCoachScheduleById = async ({ coachId, day }: CoachScheduleParams) => {
  if (!coachId || !day) return [];

  const params = new URLSearchParams({
    day,
  }).toString();

  const response = await apiRequest(`/player/coach/schedule/${coachId}?${params}`, {
    method: "GET",
  });

  if (!response?.ok) {
    throw new Error("Failed to fetch coach schedule");
  }

  const json = await safeJson<Record<string, unknown>>(response);
  return extractArray<CoachScheduleEntry>(json, ["data", "results", "items", "schedule", "schedules"]);
};

export const getCoachScheduleByIdAndLocation = async ({ coachId, day, locationId }: CoachScheduleByLocationParams) => {
  if (!coachId || !day || !locationId) return [];

  const params = new URLSearchParams({
    day,
    location: String(locationId),
  }).toString();

  const response = await apiRequest(`/player/coach/schedule/${coachId}?${params}`, {
    method: "GET",
  });

  if (!response?.ok) {
    throw new Error("Failed to fetch coach schedule for location");
  }

  const json = await safeJson<Record<string, unknown>>(response);
  return extractArray<CoachScheduleEntry>(json, ["data", "results", "items", "schedule", "schedules"]);
};

export const getCoachLessonsById = async ({ coachId, date }: CoachLessonsByDateParams) => {
  if (!coachId || !date) return [];

  const params = new URLSearchParams({
    date,
  }).toString();

  const response = await apiRequest(`/player/coach/lessons/date/${coachId}?${params}`, {
    method: "GET",
  });

  if (!response?.ok) {
    throw new Error("Failed to fetch coach lessons for date");
  }

  const json = await safeJson<Record<string, unknown>>(response);
  return extractArray<Lesson>(json, ["data", "results", "items", "lessons"]);
};

export const getCoachGoogleCalendarSyncedEvents = async ({
  coachId,
  timeMin,
  timeMax,
}: GetCoachGoogleCalendarEventsParams) => {
  if (!coachId || !timeMin || !timeMax) return [];

  const params = new URLSearchParams({
    coach_id: String(coachId),
    timeMin,
    timeMax,
  }).toString();

  const response = await apiRequest(`/player/coach/google-calendar/synced-events?${params}`, {
    method: "GET",
  });

  if (!response?.ok) {
    throw new Error("Failed to fetch Google Calendar synced events");
  }

  const json = await safeJson<Record<string, unknown> | GoogleCalendarEvent[] | null>(response);
  return extractArray<GoogleCalendarEvent>(json, ["data", "results", "items", "events"]);
};
