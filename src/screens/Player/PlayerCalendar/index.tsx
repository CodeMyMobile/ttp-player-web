import { useEffect, useMemo, useState, type ReactNode } from "react";
import moment from "moment";
import { Bell, CalendarDays, ChevronLeft, ChevronRight, MapPin, Menu, Target, Trophy, User, Users } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import "./index.css";
import { getPlayerFutureLessons, getPlayerPastLessons, type LessonSummary } from "../../../api/playerHome";
import { listMatches, normalizeMatchRecord } from "../../../api/matches";
import { getStoredAuthToken } from "../../../services/authToken";
import usePlayerIdentity from "../../../hooks/usePlayerIdentity";
import MainLayout from "../../../components/MainLayout";

type ScheduleSegment = "upcoming" | "past";
type ScheduleFilter = "all" | "lesson" | "group" | "match";
type ScheduleItemType = "lesson" | "group" | "match";
type AccentTone = "purple" | "green" | "amber" | "blue";

type ScheduleItem = {
  id: string;
  type: ScheduleItemType;
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string;
  leadingMeta: string;
  chips: string[];
  priceLabel: string | null;
  icon: ReactNode;
  accent: AccentTone;
  destination: string | null;
};

type ScheduleDayGroup = {
  key: string;
  heading: string;
  subheading: string | null;
  items: ScheduleItem[];
};

const scheduleFilters: Array<{ key: ScheduleFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "lesson", label: "Lessons" },
  { key: "group", label: "Groups" },
  { key: "match", label: "Matches" },
];

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};

const firstNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

const formatLessonStatus = (...values: unknown[]) => {
  for (const value of values) {
    const numericValue = firstNumber(value);
    if (numericValue === 0) return "Pending";
    if (numericValue === 1) return "Confirmed";
    if (numericValue === 2) return "Cancelled";
    const textValue = firstString(value);
    if (textValue) return textValue.replace(/_/g, " ");
  }
  return null;
};

const parseMoment = (...values: unknown[]) => {
  for (const value of values) {
    if (!value) continue;
    const parsed = moment(value as moment.MomentInput);
    if (parsed.isValid()) return parsed;
  }
  return null;
};

const extractLessons = (payload: unknown): LessonSummary[] => {
  if (Array.isArray(payload)) return payload as LessonSummary[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as { data?: unknown; lessons?: unknown };
  if (Array.isArray(record.data)) return record.data as LessonSummary[];
  if (Array.isArray(record.lessons)) return record.lessons as LessonSummary[];
  return [];
};

const formatLocation = (value: string | null) => value ?? "Location TBD";

const classifyLessonType = (lesson: LessonSummary): ScheduleItemType => {
  const typeName = firstString(
    (lesson as { lesson_type_name?: string }).lesson_type_name,
    (lesson as { lessonTypeName?: string }).lessonTypeName,
    lesson.title,
  )?.toLowerCase();
  const playerLimit = firstNumber(
    (lesson as { player_limit?: number }).player_limit,
    (lesson as { playerLimit?: number }).playerLimit,
  );

  if (
    (typeName && /(group|clinic|cardio|camp|doubles|semi)/i.test(typeName)) ||
    (playerLimit !== null && playerLimit > 1)
  ) {
    return "group";
  }

  return "lesson";
};

const buildLessonItem = (lesson: LessonSummary, segment: ScheduleSegment): ScheduleItem | null => {
  const startsAt = parseMoment(
    (lesson as { start_date_time_tz?: string }).start_date_time_tz,
    (lesson as { start_date_time?: string }).start_date_time,
    lesson.startTime,
    (lesson as { start_time?: string }).start_time,
  );
  if (!startsAt) return null;

  const endsAt = parseMoment(
    (lesson as { end_date_time_tz?: string }).end_date_time_tz,
    (lesson as { end_date_time?: string }).end_date_time,
    lesson.endTime,
    (lesson as { end_time?: string }).end_time,
  );

  const type = classifyLessonType(lesson);
  const isGroup = type === "group";
  const lessonId = lesson.id !== undefined && lesson.id !== null ? String(lesson.id) : null;
  const coachName = firstString(
    (lesson as { coach_name?: string }).coach_name,
    (lesson as { coachName?: string }).coachName,
    lesson.coach?.firstName && lesson.coach?.lastName
      ? `${lesson.coach.firstName} ${lesson.coach.lastName}`
      : lesson.coach?.firstName,
  );
  const title =
    firstString(
      (lesson as { metadata?: { title?: string } }).metadata?.title,
      (lesson as { metadata_title?: string }).metadata_title,
      lesson.title,
      (lesson as { lesson_type_name?: string }).lesson_type_name,
    ) ?? (isGroup ? "Group Session" : "Private Lesson");
  const location = formatLocation(
    firstString(
      (lesson as { location_name?: string }).location_name,
      (lesson as { location?: string }).location,
      (lesson as { location_text?: string }).location_text,
    ),
  );
  const level = firstString(
    (lesson as { metadata?: { level?: string } }).metadata?.level,
    (lesson as { metadata_level?: string }).metadata_level,
  );
  const playerLimit = firstNumber(
    (lesson as { player_limit?: number }).player_limit,
    (lesson as { playerLimit?: number }).playerLimit,
  );
  const currentPlayers = firstNumber(
    (lesson as { current_player_count?: number }).current_player_count,
    (lesson as { currentPlayerCount?: number }).currentPlayerCount,
  );
  const price = firstNumber(
    (lesson as { price_per_person?: number }).price_per_person,
    (lesson as { group_price_per_person?: number }).group_price_per_person,
    (lesson as { price?: number }).price,
  );
  const leadingMeta = coachName ? `Coach ${coachName}` : isGroup ? "Group session" : "Lesson session";
  const chips = [level];

  if (isGroup && playerLimit !== null) {
    chips.push(`${currentPlayers ?? 0}/${playerLimit} spots`);
  } else if (segment === "past") {
    const statusLabel = formatLessonStatus(
      (lesson as { payment_status?: unknown }).payment_status,
      (lesson as { paymentStatus?: unknown }).paymentStatus,
      (lesson as { status?: unknown }).status,
      (lesson as { booking_status?: unknown }).booking_status,
    );
    chips.push(statusLabel ?? "Completed");
  }

  return {
    id: `lesson-${lessonId ?? startsAt.toISOString()}`,
    type,
    title,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt ? endsAt.toISOString() : null,
    location,
    leadingMeta,
    chips: chips.filter(Boolean) as string[],
    priceLabel: price !== null ? `$${Number.isInteger(price) ? price : price.toFixed(2)}` : null,
    icon: isGroup ? <Users size={26} strokeWidth={2.2} /> : <User size={26} strokeWidth={2.2} />,
    accent: isGroup ? "purple" : "green",
    destination: lessonId ? (isGroup ? `/group-lessons/${lessonId}` : `/player/lesson/${lessonId}`) : null,
  };
};

const buildMatchItem = (record: unknown): ScheduleItem | null => {
  const match = normalizeMatchRecord(record);
  const startsAt = parseMoment(
    match.startDateTimeIso,
    (match.raw as { start_date_time?: string } | undefined)?.start_date_time,
  );
  if (!startsAt) return null;

  const joined = match.playersJoined;
  const total = match.totalSpots;
  const rosterChip = total > 0 ? `${joined}/${total} players` : `${joined} player${joined === 1 ? "" : "s"}`;
  const hostLabel = match.relationship === "host" ? "Hosting" : match.hostName ? `vs ${match.hostName}` : "Match play";

  return {
    id: `match-${match.id}`,
    type: "match",
    title: match.format ? `${match.format} Match` : "Match Play",
    startsAt: startsAt.toISOString(),
    endsAt: null,
    location: match.location || "Location TBD",
    leadingMeta: hostLabel,
    chips: [match.level?.summary, rosterChip].filter(Boolean) as string[],
    priceLabel: null,
    icon: match.relationship === "host" ? <Trophy size={26} strokeWidth={2.2} /> : <Target size={26} strokeWidth={2.2} />,
    accent: match.relationship === "host" ? "amber" : "blue",
    destination: `/matches/${match.id}`,
  };
};

const sortByStart = (items: ScheduleItem[], segment: ScheduleSegment) =>
  [...items].sort((left, right) =>
    segment === "upcoming"
      ? moment(left.startsAt).valueOf() - moment(right.startsAt).valueOf()
      : moment(right.startsAt).valueOf() - moment(left.startsAt).valueOf(),
  );

const buildDayGroups = (items: ScheduleItem[], segment: ScheduleSegment): ScheduleDayGroup[] => {
  const grouped = new Map<string, ScheduleItem[]>();

  items.forEach((item) => {
    const dayKey = moment(item.startsAt).format("YYYY-MM-DD");
    const list = grouped.get(dayKey) ?? [];
    list.push(item);
    grouped.set(dayKey, list);
  });

  return Array.from(grouped.entries())
    .sort(([left], [right]) =>
      segment === "upcoming"
        ? moment(left, "YYYY-MM-DD").valueOf() - moment(right, "YYYY-MM-DD").valueOf()
        : moment(right, "YYYY-MM-DD").valueOf() - moment(left, "YYYY-MM-DD").valueOf(),
    )
    .map(([dayKey, dayItems]) => {
      const day = moment(dayKey, "YYYY-MM-DD");
      const daysAway = day.startOf("day").diff(moment().startOf("day"), "days");

      let heading = day.format("dddd · MMM D").toUpperCase();
      if (daysAway === 0) heading = "TODAY";
      if (daysAway === 1) heading = "TOMORROW";
      if (daysAway === -1) heading = "YESTERDAY";

      let subheading: string | null = null;
      if (daysAway > 1) subheading = `in ${daysAway} days`;
      if (daysAway < -1) subheading = `${Math.abs(daysAway)} days ago`;

      return {
        key: dayKey,
        heading,
        subheading,
        items: sortByStart(dayItems, segment),
      };
    });
};

const PlayerCalendar = () => {
  const navigate = useNavigate();
  const { displayName, initials, avatarUrl } = usePlayerIdentity();
  const [segment, setSegment] = useState<ScheduleSegment>("upcoming");
  const [selectedFilter, setSelectedFilter] = useState<ScheduleFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upcomingItems, setUpcomingItems] = useState<ScheduleItem[]>([]);
  const [pastItems, setPastItems] = useState<ScheduleItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadSchedule = async () => {
      const token = getStoredAuthToken({ preferScheme: "token" });
      if (!token) {
        if (!cancelled) {
          setIsLoading(false);
          setError("Please sign in to view your schedule.");
        }
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [futureLessons, pastLessons, upcomingMatches, archivedMatches] = await Promise.allSettled([
          getPlayerFutureLessons({ token, perPage: 50, page: 1, signal: controller.signal }),
          getPlayerPastLessons({ token, perPage: 50, page: 1, signal: controller.signal }),
          listMatches({
            token,
            filter: "my",
            status: "upcoming",
            includeHidden: true,
            include_hidden: true,
            perPage: 50,
            page: 1,
            signal: controller.signal,
          }),
          listMatches({
            token,
            filter: "my",
            status: "archived",
            includeHidden: true,
            include_hidden: true,
            perPage: 50,
            page: 1,
            signal: controller.signal,
          }),
        ]);

        if (cancelled) return;

        const nextUpcomingItems = [
          ...(futureLessons.status === "fulfilled" ? extractLessons(futureLessons.value).map((item) => buildLessonItem(item, "upcoming")) : []),
          ...(upcomingMatches.status === "fulfilled" ? upcomingMatches.value.matches.map(buildMatchItem) : []),
        ].filter(Boolean) as ScheduleItem[];

        const nextPastItems = [
          ...(pastLessons.status === "fulfilled" ? extractLessons(pastLessons.value).map((item) => buildLessonItem(item, "past")) : []),
          ...(archivedMatches.status === "fulfilled" ? archivedMatches.value.matches.map(buildMatchItem) : []),
        ].filter(Boolean) as ScheduleItem[];

        setUpcomingItems(sortByStart(nextUpcomingItems, "upcoming"));
        setPastItems(sortByStart(nextPastItems, "past"));

        const failures = [futureLessons, pastLessons, upcomingMatches, archivedMatches].filter((result) => result.status === "rejected");
        if (failures.length > 0 && nextUpcomingItems.length === 0 && nextPastItems.length === 0) {
          const firstFailure = failures[0] as PromiseRejectedResult;
          throw firstFailure.reason;
        }
      } catch (loadError) {
        if (!cancelled) {
          setUpcomingItems([]);
          setPastItems([]);
          setError(loadError instanceof Error ? loadError.message : "Unable to load your schedule.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadSchedule();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const activeItems = segment === "upcoming" ? upcomingItems : pastItems;

  const filterCounts = useMemo(
    () => ({
      all: activeItems.length,
      lesson: activeItems.filter((item) => item.type === "lesson").length,
      group: activeItems.filter((item) => item.type === "group").length,
      match: activeItems.filter((item) => item.type === "match").length,
    }),
    [activeItems],
  );

  const visibleItems = useMemo(
    () => activeItems.filter((item) => (selectedFilter === "all" ? true : item.type === selectedFilter)),
    [activeItems, selectedFilter],
  );

  const dayGroups = useMemo(() => buildDayGroups(visibleItems, segment), [segment, visibleItems]);

  const summaryLabel =
    segment === "upcoming"
      ? `${activeItems.length} session${activeItems.length === 1 ? "" : "s"} coming up`
      : `${activeItems.length} past session${activeItems.length === 1 ? "" : "s"}`;

  return (
    <MainLayout mobileChrome="home" showDesktopNav={false}>
      <div className="schedule-page">
        <header className="schedule-page__topbar">
          <button type="button" className="schedule-page__icon-button" onClick={() => navigate(-1)} aria-label="Go back">
            <ChevronLeft size={24} />
          </button>

          <Link to="/" className="schedule-page__brand">
            <span className="schedule-page__brand-mark">🎾</span>
            <strong>
              The Tennis <span>Plan</span>
            </strong>
          </Link>

          <div className="schedule-page__topbar-actions">
            <Link to="/notifications" className="schedule-page__icon-button" aria-label="Open notifications">
              <Bell size={22} />
            </Link>
            <Link to="/settings/profile" className="schedule-page__avatar">
              {avatarUrl ? <img src={avatarUrl} alt={displayName ? `${displayName} profile` : "Player profile"} /> : initials}
            </Link>
          </div>
        </header>

        <main className="schedule-page__body">
          <section className="schedule-page__hero">
            <div>
              <h1>My Schedule</h1>
              <p>{summaryLabel}</p>
            </div>

            <div className="schedule-page__hero-actions" aria-hidden="true">
              <span className="schedule-page__icon-button">
                <Menu size={22} />
              </span>
              <span className="schedule-page__icon-button">
                <CalendarDays size={22} />
              </span>
            </div>
          </section>

          <section className="schedule-page__segment-row" aria-label="Schedule period">
            <button
              type="button"
              className={`schedule-page__segment${segment === "upcoming" ? " is-active" : ""}`}
              onClick={() => setSegment("upcoming")}
            >
              Upcoming
            </button>
            <button
              type="button"
              className={`schedule-page__segment${segment === "past" ? " is-active" : ""}`}
              onClick={() => setSegment("past")}
            >
              Past
            </button>
          </section>

          <section className="schedule-page__filter-row" aria-label="Schedule type filters">
            {scheduleFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`schedule-page__filter-chip${selectedFilter === filter.key ? " is-active" : ""}`}
                onClick={() => setSelectedFilter(filter.key)}
              >
                <span>{filter.label}</span>
                <strong>{filterCounts[filter.key]}</strong>
              </button>
            ))}
          </section>

          {isLoading ? <p className="schedule-page__feedback">Loading your schedule…</p> : null}
          {error ? <p className="schedule-page__feedback schedule-page__feedback--error">{error}</p> : null}
          {!isLoading && !error && dayGroups.length === 0 ? (
            <p className="schedule-page__feedback">No sessions found for this view.</p>
          ) : null}

          <section className="schedule-page__groups">
            {dayGroups.map((group) => (
              <div key={group.key} className="schedule-page__group">
                <header className="schedule-page__group-header">
                  <h2>{group.heading}</h2>
                  {group.subheading ? <p>{group.subheading}</p> : null}
                </header>

                <div className="schedule-page__cards">
                  {group.items.map((item) => {
                    const start = moment(item.startsAt);
                    const end = item.endsAt ? moment(item.endsAt) : start.clone().add(90, "minutes");
                    const timeRange = (() => {
                      return `${start.format("h:mm A")} – ${end.format("h:mm A")}`;
                    })();

                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`schedule-card schedule-card--${item.accent}`}
                        onClick={() => item.destination && navigate(item.destination)}
                        disabled={!item.destination}
                      >
                        <span className={`schedule-card__icon schedule-card__icon--${item.accent}`}>{item.icon}</span>

                        <span className="schedule-card__content">
                          <span className="schedule-card__time">{timeRange}</span>
                          <strong>{item.title}</strong>
                          <span className="schedule-card__location">
                            <MapPin size={14} />
                            <span>{item.location}</span>
                          </span>
                          <span className="schedule-card__meta">
                            <span>{item.leadingMeta}</span>
                            {item.chips.map((chip) => (
                              <span key={chip} className="schedule-card__chip">
                                {chip}
                              </span>
                            ))}
                          </span>
                        </span>

                        <span className="schedule-card__aside">
                          {item.priceLabel ? <strong>{item.priceLabel}</strong> : <span />}
                          <ChevronRight size={20} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        </main>
      </div>
    </MainLayout>
  );
};

export default PlayerCalendar;
