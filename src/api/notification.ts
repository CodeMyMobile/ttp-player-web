import { request } from "./http";

export interface NotificationPaginationParams {
  token: string;
  perPage?: number;
  page?: number;
  signal?: AbortSignal;
}

export interface NotificationLesson {
  id?: number;
  start_date_time?: string;
  end_date_time?: string;
  location?: string;
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
  unread?: number;
  total?: number;
  [key: string]: unknown;
}

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
