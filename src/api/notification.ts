import { request } from "./http";

export interface NotificationPaginationParams {
  token: string;
  perPage?: number;
  page?: number;
  signal?: AbortSignal;
}

export interface NotificationGroupPlayer {
  player_id?: number;
  full_name?: string;
  email?: string;
  profile_picture?: string;
  payment_status?: number | string;
  paymentStatus?: number | string;
  status?: number;
  [key: string]: unknown;
}

export interface NotificationLesson {
  id?: number;
  player_id?: number;
  start_date_time?: string;
  end_date_time?: string;
  status?: number;
  payment_status?: number | string;
  paymentStatus?: number | string;
  court?: number | null;
  location_id?: number;
  created_by?: number;
  updated_by?: number;
  payment_method_id?: string | null;
  full_name?: string;
  latitude?: string | null;
  longitude?: string | null;
  location?: string;
  hourly_rate?: number | string | null;
  group_lesson_price_id?: number | null;
  group_price_per_person?: number | string | null;
  discount_percentage?: number | null;
  lesson_type_name?: string;
  lessontype_id?: number | string;
  lesson_type_id?: number | string;
  lessonTypeId?: number | string;
  group_players?: NotificationGroupPlayer[] | null;
  [key: string]: unknown;
}

export interface PlayerNotification {
  id?: number | string;
  profile_url?: string;
  title?: string;
  message?: string;
  created_at?: string;
  createdAt?: string;
  seen?: boolean;
  entity_id?: number;
  entity?: number;
  action?: number;
  actor_id?: number;
  lesson?: NotificationLesson;
  [key: string]: unknown;
}

export interface NotificationCount {
  /** Unseen notifications. ttp-api sends `{ count }`, as a string (Postgres counts are bigint). */
  count?: number | string;
  unread?: number;
  total?: number;
  [key: string]: unknown;
}

/**
 * The bell's number from /notification_count. The bell read `unread`, which the API never
 * sends, so it never lit up. `unread` is still honoured in case the API is changed to send it.
 */
export const unreadNotificationCount = (response: unknown): number => {
  const body = response as (NotificationCount & { data?: NotificationCount }) | null | undefined;
  const data = body?.data ?? body;
  const value = Number(data?.count ?? data?.unread ?? 0);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
};

export type NotificationListResponse =
  | PlayerNotification[]
  | { data?: PlayerNotification[]; notifications?: PlayerNotification[] };

export const extractNotificationList = (response: NotificationListResponse | null | undefined): PlayerNotification[] => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.notifications)) return response.notifications;
  return [];
};

export const getNotifications = async ({ token, perPage = 10, page = 1, signal }: NotificationPaginationParams) =>
  request<NotificationListResponse>("/notification", {
    token,
    signal,
    query: {
      perPage,
      page,
    },
  });

export const getNotificationCount = async ({ token, perPage = 10, page = 1, signal }: NotificationPaginationParams) =>
  request<NotificationCount | { data?: NotificationCount }>("/notification_count", {
    token,
    signal,
    query: {
      perPage,
      page,
    },
  });
