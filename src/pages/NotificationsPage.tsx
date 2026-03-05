import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import MainLayout from "../components/MainLayout";
import LessonDetailCard from "../components/LessonDetailCard";
import { extractNotificationList, getNotifications, type PlayerNotification } from "../api/notification";
import type { Lesson } from "../api/playerLessons";
import { getStoredAuthToken } from "../services/authToken";

const DEFAULT_PER_PAGE = 10;

const formatNotificationDate = (notification: PlayerNotification) => {
  const value = notification.created_at ?? notification.createdAt;
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const mapNotificationLessonToCardLesson = (notification: PlayerNotification): Lesson | null => {
  const lesson = notification.lesson;
  if (!lesson?.id || !lesson.start_date_time || !lesson.end_date_time) return null;

  return {
    id: toNumber(lesson.id),
    coach_id: toNumber(notification.actor_id),
    coach_name: notification.title ?? "Coach",
    location_id: toNumber(lesson.location_id),
    location_name: lesson.location,
    start_date_time: lesson.start_date_time,
    end_date_time: lesson.end_date_time,
    lesson_type_name: lesson.lesson_type_name,
    price_per_person: toNumber(lesson.hourly_rate),
    player_limit: Array.isArray(lesson.group_players) ? lesson.group_players.length : undefined,
    current_player_count: Array.isArray(lesson.group_players) ? lesson.group_players.length : undefined,
    metadata: {
      title: `${lesson.lesson_type_name ?? "Lesson"} lesson`,
      description: notification.message ?? "",
    },
  };
};

const NotificationsPage = () => {
  const [page, setPage] = useState(1);
  const [notifications, setNotifications] = useState<PlayerNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);

  const token = useMemo(() => getStoredAuthToken({ preferScheme: "token" }), []);

  useEffect(() => {
    if (!token) {
      setError("Please sign in again to view notifications.");
      return;
    }

    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await getNotifications({
          token,
          perPage: DEFAULT_PER_PAGE,
          page: 1,
          signal: controller.signal,
        });
        const list = extractNotificationList(response);
        setNotifications(list);
        setPage(1);
        setHasMore(list.length === DEFAULT_PER_PAGE);
      } catch {
        setError("We could not load your notifications right now.");
      } finally {
        setLoading(false);
      }
    };

    load();

    return () => controller.abort();
  }, [token]);

  const loadMore = async () => {
    if (!token || loadingMore || !hasMore) return;

    const nextPage = page + 1;
    setLoadingMore(true);
    setError("");

    try {
      const response = await getNotifications({
        token,
        perPage: DEFAULT_PER_PAGE,
        page: nextPage,
      });
      const list = extractNotificationList(response);
      setNotifications((prev) => [...prev, ...list]);
      setPage(nextPage);
      setHasMore(list.length === DEFAULT_PER_PAGE);
    } catch {
      setError("Unable to load more notifications.");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <MainLayout>
      <section className="notifications-page" aria-labelledby="notifications-page-title">
        <div className="notifications-page__header">
          <h1 id="notifications-page-title">All Notifications</h1>
          <p>Stay up to date with your latest booking and lesson updates.</p>
        </div>

        {loading ? (
          <p className="notifications-page__state">Loading notifications…</p>
        ) : error ? (
          <p className="notifications-page__state notifications-page__state--error">{error}</p>
        ) : notifications.length === 0 ? (
          <p className="notifications-page__state">No notifications yet.</p>
        ) : (
          <>
            <ul className="notifications-page__list">
              {notifications.map((notification, index) => {
                const key = notification.id ?? `${notification.title ?? "notification"}-${index}`;
                const lessonForCard = mapNotificationLessonToCardLesson(notification);

                return (
                  <li key={key} className="notifications-page__item">
                    <div className="notifications-page__summary">
                      {notification.profile_url ? (
                        <img src={notification.profile_url} alt="Sender" className="notifications-page__avatar" />
                      ) : (
                        <div className="notifications-page__avatar notifications-page__avatar--fallback" aria-hidden="true">
                          {notification.title?.slice(0, 1) ?? "N"}
                        </div>
                      )}
                      <div className="notifications-page__content">
                        <p className="notifications-page__title">{notification.title ?? "Notification"}</p>
                        <p className="notifications-page__message">{notification.message ?? "New update available."}</p>
                        <p className="notifications-page__time">{formatNotificationDate(notification)}</p>
                      </div>
                    </div>

                    {lessonForCard && (
                      <div className="notifications-page__lesson-card">
                        <LessonDetailCard lesson={lessonForCard} />
                        <div className="notifications-page__lesson-actions">
                          <Link to={`/player/lesson/${lessonForCard.id}`} className="notifications-page__lesson-link">
                            View lesson details
                          </Link>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="notifications-page__footer">
              {hasMore ? (
                <button type="button" className="notifications-page__load-more" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              ) : (
                <p className="notifications-page__state">You are all caught up.</p>
              )}
            </div>
          </>
        )}
      </section>
    </MainLayout>
  );
};

export default NotificationsPage;
