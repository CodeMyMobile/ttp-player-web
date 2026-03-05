import { request } from "./http";

export interface NotificationPaginationParams {
  token: string;
  perPage?: number;
  page?: number;
  signal?: AbortSignal;
}

export interface PlayerNotification {
  id?: number | string;
  title?: string;
  message?: string;
  body?: string;
  createdAt?: string;
  created_at?: string;
  read?: boolean;
  isRead?: boolean;
  [key: string]: unknown;
}

export interface NotificationCount {
  unread?: number;
  total?: number;
  [key: string]: unknown;
}

export const getNotifications = async ({ token, perPage = 10, page = 1, signal }: NotificationPaginationParams) =>
  request<PlayerNotification[] | { data?: PlayerNotification[]; notifications?: PlayerNotification[] }>("/notification", {
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
