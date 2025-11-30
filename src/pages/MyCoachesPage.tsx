import {
  ArrowRight,
  Calendar,
  Clock3,
  Loader2,
  MapPin,
  RefreshCcw,
  Search,
  Star,
  Users2,
} from "lucide-react";
import moment from "moment";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { fetchAvailableLessons, fetchCoachLessonsByDate, fetchCoachSchedule } from "../api/playerLessons";
import { getPlayerCoaches, type PlayerCoach } from "../api/playerCalendar";
import MainLayout from "../components/MainLayout";
import StateBanner from "../components/coaches/StateBanner";
import { useAuth } from "../context/AuthContext";
import useDebouncedValue from "../hooks/useDebouncedValue";

import "./MyCoachesPage.css";

const AVAILABILITY_LOOKAHEAD_DAYS = 16;
const PRIVATE_SLOT_LIMIT = 4;
const AVAILABILITY_WINDOW_DAYS = 12;

type CoachStatusBadgeProps = {
  status?: string | number;
};

type LessonSelection =
  | { type: "private"; slot: PrivateSlot }
  | { type: "group"; lesson: GroupLesson }
  | null;

type PrivateSlot = {
  id: string;
  time: string;
  dayLabel: string;
  lessonType: "private";
  duration: string;
  price: string;
  isoDate: string;
  spotsRemaining: number;
  location?: string | null;
  scheduleMeta?: {
    startDateTime: string;
    endDateTime: string;
    startDateTimeTz: string;
    endDateTimeTz: string;
    locationId?: number | null;
    court?: string | null;
  };
};

type GroupLesson = {
  id: string | number;
  title: string;
  start: moment.Moment;
  end: moment.Moment;
  duration: string;
  spotsRemaining: number | null;
  price: number | null;
};

const CoachStatusBadge = ({ status }: CoachStatusBadgeProps) => {
  if (status === null || status === undefined || status === "") return null;
  return <span className="my-coaches__status">{String(status)}</span>;
};

const postalRegex = /\b\d{5}(?:-\d{4})?\b/;

const pickCoachId = (coach: PlayerCoach) =>
  (coach as Record<string, unknown>).coach_id ??
  coach.id ??
  (coach as Record<string, unknown>).user_id ??
  (coach as Record<string, unknown>).player_coach_id;

const resolveName = (coach: PlayerCoach) => {
  const record = coach as Record<string, unknown>;
  const parts = [
    record.full_name,
    record.fullName,
    record.coach_name,
    record.name,
    [record.first_name, record.last_name].filter(Boolean).join(" ").trim(),
    [record.firstName, record.lastName].filter(Boolean).join(" ").trim(),
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  return parts[0] || "Coach";
};

const resolveAvatar = (coach: PlayerCoach) => {
  const record = coach as Record<string, unknown>;
  const candidates = [
    record.avatar_url,
    record.avatar,
    record.profile_image,
    record.profile_picture,
    record.photo,
    record.image,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }
  return "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=256&q=80";
};

const resolveRating = (coach: PlayerCoach) => {
  const record = coach as Record<string, unknown>;
  const value = record.rating ?? record.average_rating ?? record.avg_rating ?? record.score;
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric.toFixed(1) : null;
};

const pickCoachLocationLabel = (coach: PlayerCoach) => {
  const record = coach as Record<string, unknown>;
  const candidates = [
    ...(Array.isArray(record.locationPlaces)
      ? (record.locationPlaces as Array<{ label?: string | null }>).map((item) => item?.label)
      : []),
    ...(Array.isArray(record.locationList) ? (record.locationList as Array<string | null>) : []),
    record.location,
    record.location_name,
    record.facility,
    record.city && record.state ? `${record.city}, ${record.state}` : null,
    record.city,
    record.state,
  ];

  const label = candidates.find(
    (entry) => typeof entry === "string" && entry.trim() && !postalRegex.test(entry.trim()),
  );

  return label?.toString().trim() || "Location TBD";
};

const resolveStatus = (coach: PlayerCoach) => {
  const record = coach as Record<string, unknown>;
  const raw =
    record.player_coach_status_text ??
    record.status_text ??
    record.player_status ??
    record.status ??
    record.player_coach_status;

  if (raw === null || raw === undefined || raw === "") return undefined;

  const numeric = Number(raw);
  const statusLookup: Record<number, string> = {
    0: "Pending",
    1: "Confirmed",
    2: "Cancelled",
  };

  if (!Number.isNaN(numeric) && statusLookup[numeric]) {
    return statusLookup[numeric];
  }

  if (typeof raw === "string") return raw;
  return String(raw);
};

const resolveHourlyRate = (coach: PlayerCoach) => {
  const record = coach as Record<string, unknown>;
  const value = record.hourly_rate ?? record.rate ?? record.price_per_hour;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return `$${numeric.toFixed(0)}/hr`;
};

const buildScheduleMoment = (isoDate: string, time: string) => {
  if (!isoDate || !time) return null;
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  const combined = moment(
    `${isoDate}T${normalizedTime}`,
    ["YYYY-MM-DDTHH:mm:ss", "YYYY-MM-DDTHH:mm"],
    true,
  );
  return combined.isValid() ? combined : null;
};

const resolveScheduleLocation = (entry: Record<string, unknown>) => {
  const candidates = [entry.location, entry.location_name, entry.court_name, entry.court];
  const label = candidates.find(
    (candidate) => typeof candidate === "string" && candidate.trim() && !postalRegex.test(candidate.trim()),
  );
  return label?.trim();
};

const buildSlotsFromScheduleEntry = (
  entry: Record<string, any>,
  isoDate: string,
  priceLabel = "$0",
  fallbackIndex = 0,
): PrivateSlot[] => {
  const startMoment = buildScheduleMoment(isoDate, entry.from as string);
  if (!startMoment) return [];
  const endMoment = buildScheduleMoment(isoDate, entry.to as string);
  const slotIdBase =
    entry.id !== undefined && entry.id !== null ? String(entry.id) : `${fallbackIndex}`;
  const slots: PrivateSlot[] = [];

  if (endMoment && endMoment.isAfter(startMoment)) {
    let cursor = startMoment.clone();
    let segmentIndex = 0;
    while (cursor.isBefore(endMoment)) {
      const segmentEnd = cursor.clone().add(1, "hour");
      if (segmentEnd.isAfter(endMoment)) break;
      slots.push({
        id: `${isoDate}-${slotIdBase}-seg-${segmentIndex}`,
        time: cursor.format("h:mm A"),
        lessonType: "private",
        duration: `${segmentEnd.diff(cursor, "minutes")} min`,
        price: priceLabel,
        spotsRemaining: 1,
        isoDate,
        dayLabel: moment(isoDate).format("ddd"),
        location: resolveScheduleLocation(entry),
        scheduleMeta: {
          startDateTime: cursor.clone().utc().toISOString(),
          endDateTime: segmentEnd.clone().utc().toISOString(),
          startDateTimeTz: cursor.toISOString(),
          endDateTimeTz: segmentEnd.toISOString(),
          locationId: entry.location_id as number | null,
          court: (entry.court as string) ?? null,
        },
      });
      cursor = segmentEnd;
      segmentIndex += 1;
    }
  }

  if (slots.length) return slots;

  const durationMinutes = endMoment ? Math.max(endMoment.diff(startMoment, "minutes"), 0) : null;
  const computedDuration =
    durationMinutes && Number.isFinite(durationMinutes) && durationMinutes > 0
      ? durationMinutes
      : 60;
  const derivedEndMoment = endMoment ?? startMoment.clone().add(computedDuration, "minutes");

  return [
    {
      id: `${isoDate}-${slotIdBase}`,
      time: startMoment.format("h:mm A"),
      lessonType: "private",
      duration: `${computedDuration} min`,
      price: priceLabel,
      spotsRemaining: 1,
      isoDate,
      dayLabel: moment(isoDate).format("ddd"),
      location: resolveScheduleLocation(entry),
      scheduleMeta: {
        startDateTime: startMoment.clone().utc().toISOString(),
        endDateTime: derivedEndMoment.clone().utc().toISOString(),
        startDateTimeTz: startMoment.toISOString(),
        endDateTimeTz: derivedEndMoment.toISOString(),
        locationId: entry.location_id as number | null,
        court: (entry.court as string) ?? null,
      },
    },
  ];
};

const resolveUpcomingLesson = (coach: PlayerCoach) => {
  const record = coach as Record<string, unknown>;
  const dateCandidate = record.next_lesson_date ?? record.nextLessonDate ?? record.next_lesson_day ?? record.nextLessonDay;
  const timeCandidate = record.next_lesson_time ?? record.nextLessonTime;
  const typeCandidate = (record.next_lesson_type ?? record.nextLessonType ?? "").toString().toLowerCase();
  const isGroup = typeCandidate.includes("group");
  const isPrivate = typeCandidate.includes("private") || (!typeCandidate && !isGroup);
  if (!dateCandidate && !timeCandidate) return null;
  return {
    date: String(dateCandidate ?? ""),
    time: String(timeCandidate ?? ""),
    label: [dateCandidate, timeCandidate].filter(Boolean).join(" · "),
    tone: isGroup ? "group" : isPrivate ? "private" : "info",
  } as const;
};

const isPendingCoach = (coach: PlayerCoach) => {
  const status = resolveStatus(coach)?.toString().toLowerCase();
  return status === "pending" || status === "0";
};

const MyCoachBookingCard = ({ coach, authToken }: { coach: PlayerCoach; authToken: string | null }) => {
  const [privateSlots, setPrivateSlots] = useState<PrivateSlot[]>([]);
  const [groupClasses, setGroupClasses] = useState<GroupLesson[]>([]);
  const [selection, setSelection] = useState<LessonSelection>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const coachId = pickCoachId(coach);
  const numericCoachId = Number(coachId);
  const coachSlug = (coach as Record<string, unknown>).slug as string | undefined;
  const coachName = resolveName(coach);
  const locationLabel = pickCoachLocationLabel(coach);
  const hourlyRateLabel = resolveHourlyRate(coach);
  const upcomingLesson = useMemo(() => resolveUpcomingLesson(coach), [coach]);

  useEffect(() => {
    if (!coachId || !Number.isFinite(numericCoachId)) return;
    let cancelled = false;
    const loadAvailability = async () => {
      setLoadingSlots(true);
      setError(null);
      const collectedSlots: PrivateSlot[] = [];
      const hourlyLabel = hourlyRateLabel || "$0";

      for (let offset = 0; offset < AVAILABILITY_LOOKAHEAD_DAYS; offset += 1) {
        if (collectedSlots.length >= PRIVATE_SLOT_LIMIT) break;
        const dateMoment = moment().add(offset, "days");
        const isoDate = dateMoment.format("YYYY-MM-DD");
        const weekday = dateMoment.format("dddd").toUpperCase();
        let scheduleEntries: any[] = [];
        try {
          scheduleEntries = await fetchCoachSchedule({
            token: authToken ?? "",
            coachId: numericCoachId,
            day: weekday,
          });
        } catch (err) {
          scheduleEntries = [];
        }

        if (!scheduleEntries.length) continue;

        let bookedLessons: any[] = [];
        try {
          bookedLessons = await fetchCoachLessonsByDate({
            token: authToken ?? undefined,
            coachId: numericCoachId,
            date: isoDate,
          });
        } catch (err) {
          bookedLessons = [];
        }

        const bookedTimes = new Set(
          bookedLessons
            .map((lesson) => moment(lesson.start_date_time).format("HH:mm"))
            .filter(Boolean),
        );

        const dailySlots = scheduleEntries
          .flatMap((entry, index) => buildSlotsFromScheduleEntry(entry, isoDate, hourlyLabel, index))
          .filter((slot) => {
            const slotStart = slot.scheduleMeta?.startDateTimeTz
              ? moment(slot.scheduleMeta.startDateTimeTz).format("HH:mm")
              : moment(`${isoDate} ${slot.time}`, ["YYYY-MM-DD h:mm A", "YYYY-MM-DD HH:mm"]).format("HH:mm");
            return slotStart ? !bookedTimes.has(slotStart) : true;
          });

        collectedSlots.push(
          ...dailySlots.map((slot) => ({
            ...slot,
            dayLabel: dateMoment.format("ddd"),
          })),
        );
      }

      if (!cancelled) {
        setPrivateSlots(collectedSlots.slice(0, PRIVATE_SLOT_LIMIT));
      }

      try {
        const startIso = moment().format("YYYY-MM-DD");
        const endIso = moment().add(AVAILABILITY_WINDOW_DAYS, "days").format("YYYY-MM-DD");
        const lessonsResponse = await fetchAvailableLessons({
          token: authToken ?? "",
          start_date: startIso,
          end_date: endIso,
          coach_id: numericCoachId,
        });
        const lessonData = Array.isArray((lessonsResponse as any)?.data)
          ? (lessonsResponse as any).data
          : [];
        const groups: GroupLesson[] = lessonData
          .filter((lesson: any) => {
            const typeLabel = (lesson.lesson_type_name ?? lesson.metadata?.title ?? "")
              .toString()
              .toLowerCase();
            return typeLabel.includes("group") || (lesson.player_limit ?? 1) > 1;
          })
          .map((lesson: any) => ({
            id: lesson.id,
            title: lesson.metadata?.title ?? lesson.metadata_title ?? lesson.lesson_type_name ?? "Group Class",
            start: moment(lesson.start_date_time),
            end: moment(lesson.end_date_time),
            duration: lesson.end_date_time
              ? `${moment(lesson.end_date_time).diff(moment(lesson.start_date_time), "minutes")} min`
              : "60 min",
            spotsRemaining: Math.max((lesson.player_limit ?? 0) - (lesson.current_player_count ?? 0), 0) || null,
            price: lesson.price_per_person ?? null,
          }));
        if (!cancelled) {
          setGroupClasses(groups.slice(0, 3));
        }
      } catch (err) {
        if (!cancelled) {
          setError("Could not load class availability");
        }
      } finally {
        if (!cancelled) {
          setLoadingSlots(false);
        }
      }
    };

    loadAvailability();
    return () => {
      cancelled = true;
    };
  }, [authToken, coach, coachId, hourlyRateLabel, numericCoachId]);

  const handleBook = () => {
    if (!selection || !coachId) return;
    const scheduleState = selection.type === "private" ? { slot: selection.slot } : { lesson: selection.lesson };
    const url = `/coaches/${coachSlug || coachId}`;
    navigate(url, { state: { quickBook: scheduleState } });
  };

  const buttonTone = selection?.type === "group" ? "group" : "primary";
  const buttonLabel = selection
    ? selection.type === "private"
      ? `Book Private — ${selection.slot.dayLabel} at ${selection.slot.time} — ${selection.slot.price}`
      : `Book ${selection.lesson.title} — $${selection.lesson.price ?? ""}`
    : "Select a time to book";

  return (
    <article className="my-coach-card">
      <header className="my-coach-card__header">
        <div className="my-coach-card__identity">
          <img className="my-coach-card__avatar" src={resolveAvatar(coach)} alt={`Portrait of ${coachName}`} />
          <div>
            <div className="my-coach-card__title-row">
              <h3>{coachName}</h3>
              {resolveRating(coach) ? (
                <span className="my-coach-card__rating">
                  <Star size={14} aria-hidden />
                  {resolveRating(coach)}
                </span>
              ) : null}
            </div>
            <p className="my-coach-card__location">
              <MapPin size={14} aria-hidden />
              {locationLabel}
            </p>
          </div>
        </div>
        {hourlyRateLabel ? <span className="my-coach-card__badge">{hourlyRateLabel}</span> : null}
      </header>

      {upcomingLesson ? (
        <div className={`my-coach-card__upcoming ${upcomingLesson.tone}`}>
          <Calendar size={14} aria-hidden />
          <span>Upcoming: {upcomingLesson.label}</span>
        </div>
      ) : null}

      <section className="my-coach-card__section">
        <div className="my-coach-card__section-header">
          <div>
            <div className="label">Private lessons</div>
            <p>Select a time to book quickly.</p>
          </div>
          {hourlyRateLabel ? <span className="my-coach-card__pill">{hourlyRateLabel}</span> : null}
        </div>
        <div className="my-coach-card__slots">
          {loadingSlots && !privateSlots.length ? (
            <div className="my-coach-card__loading">
              <Loader2 className="spin" size={16} aria-hidden /> Loading times
            </div>
          ) : null}
          {privateSlots.slice(0, PRIVATE_SLOT_LIMIT).map((slot) => {
            const isSelected = selection?.type === "private" && selection.slot.id === slot.id;
            return (
              <button
                key={slot.id}
                type="button"
                className={`my-coach-card__slot${isSelected ? " selected" : ""}`}
                onClick={() =>
                  setSelection((prev) =>
                    prev?.type === "private" && prev.slot.id === slot.id
                      ? null
                      : {
                          type: "private",
                          slot,
                        },
                  )
                }
              >
                <div className="my-coach-card__slot-day">{slot.dayLabel}</div>
                <div className="my-coach-card__slot-time">{slot.time}</div>
              </button>
            );
          })}
          {!loadingSlots && !privateSlots.length ? (
            <p className="my-coach-card__muted">No upcoming private slots in the next two weeks.</p>
          ) : null}
        </div>
        <Link to={`/coaches/${coachSlug || coachId}`} className="my-coach-card__link">
          All times <ArrowRight size={14} aria-hidden />
        </Link>
      </section>

      {groupClasses.length ? (
        <section className="my-coach-card__section">
          <div className="my-coach-card__section-header group">
            <div>
              <div className="label">Group classes</div>
              <p>Join a class with available spots.</p>
            </div>
          </div>
          <div className="my-coach-card__classes">
            {groupClasses.map((lesson) => {
              const isSelected = selection?.type === "group" && selection.lesson.id === lesson.id;
              return (
                <button
                  key={lesson.id}
                  type="button"
                  className={`my-coach-card__class${isSelected ? " selected" : ""}`}
                  onClick={() =>
                    setSelection((prev) =>
                      prev?.type === "group" && prev.lesson.id === lesson.id
                        ? null
                        : { type: "group", lesson },
                    )
                  }
                >
                  <div>
                    <div className="my-coach-card__class-title">{lesson.title}</div>
                    <div className="my-coach-card__class-meta">
                      <Clock3 size={14} aria-hidden />
                      <span>
                        {lesson.start.format("ddd, MMM D")} · {lesson.start.format("h:mm A")} ({lesson.duration})
                      </span>
                    </div>
                    <div className="my-coach-card__class-meta">
                      <Users2 size={14} aria-hidden />
                      <span>
                        {lesson.spotsRemaining !== null ? `${lesson.spotsRemaining} spots left` : "Open enrollment"}
                      </span>
                    </div>
                  </div>
                  <div className="my-coach-card__class-price">
                    {lesson.price ? `$${lesson.price}` : "See price"}
                  </div>
                </button>
              );
            })}
          </div>
          <Link to={`/coaches/${coachSlug || coachId}`} className="my-coach-card__link group">
            All classes <ArrowRight size={14} aria-hidden />
          </Link>
        </section>
      ) : null}

      {error ? <p className="my-coach-card__error">{error}</p> : null}

      <button
        type="button"
        className={`my-coach-card__cta ${buttonTone}`}
        disabled={!selection}
        aria-disabled={!selection}
        onClick={handleBook}
      >
        {buttonLabel}
      </button>
    </article>
  );
};

const PendingCoachRow = ({ coach }: { coach: PlayerCoach }) => {
  const initials = resolveName(coach).slice(0, 2).toUpperCase();
  const record = coach as Record<string, any>;
  const requestDate = record.requested_at || record.request_date || record.created_at || record.createdAt || null;
  const requestLabel = requestDate ? moment(requestDate).format("MMM D, YYYY") : "Recently requested";
  const avatar = resolveAvatar(coach);

  return (
    <li className="pending-coach-row">
      <div className="pending-coach-row__identity">
        <div className="pending-coach-row__avatar" aria-hidden>
          {avatar ? <img src={avatar} alt="" /> : <span>{initials}</span>}
        </div>
        <div>
          <p className="pending-coach-row__name">{resolveName(coach)}</p>
          <p className="pending-coach-row__status">Awaiting approval · Requested {requestLabel}</p>
        </div>
      </div>
      <div className="pending-coach-row__actions">
        <button type="button" className="ghost">
          View
        </button>
        <button type="button" className="text">
          Cancel
        </button>
      </div>
    </li>
  );
};

const buildQueryParams = (search: string) => ({
  search: search.trim(),
});

const MyCoachesPage = () => {
  const { user } = useAuth();
  const playerToken =
    user?.session?.access_token ?? user?.access_token ?? user?.token ?? null;
  const [coaches, setCoaches] = useState<PlayerCoach[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  const fetchCoaches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPlayerCoaches({
        perPage: 25,
        page: 1,
        ...buildQueryParams(debouncedSearch),
      });
      setCoaches(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load coaches";
      setError(message);
      setCoaches([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchCoaches();
  }, [fetchCoaches]);

  const confirmedCoaches = useMemo(
    () => coaches.filter((coach) => !isPendingCoach(coach)),
    [coaches],
  );
  const pendingCoaches = useMemo(
    () => coaches.filter((coach) => isPendingCoach(coach)),
    [coaches],
  );

  const filteredConfirmed = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return confirmedCoaches;
    return confirmedCoaches.filter((coach) => resolveName(coach).toLowerCase().includes(query));
  }, [confirmedCoaches, debouncedSearch]);

  const showEmpty = !loading && !error && confirmedCoaches.length === 0 && pendingCoaches.length === 0;

  return (
    <MainLayout>
      <div className="my-coaches">
        <div className="my-coaches__inner">
          <header className="my-booking-hero">
            <div className="my-booking-hero__content">
              <p className="coach-hero-eyebrow">My Coaches</p>
              <h1>Book your next lesson fast</h1>
            <p className="coach-hero-subtitle">
              Tap a slot on a coach card to prefill the booking button instantly.
            </p>
            <div className="my-booking-hero__chips" role="tablist" aria-label="Coach views">
              <button type="button" role="tab" aria-selected className="coach-tab active">
                Quick book
              </button>
              <Link to="/coaches" role="tab" aria-selected={false} className="coach-tab">
                Browse all coaches
              </Link>
            </div>
            <div className="my-booking-hero__meta">
              <div>
                <p className="label">Connected coaches</p>
                <p className="my-booking-hero__meta-value">{confirmedCoaches.length}</p>
              </div>
              <div>
                <p className="label">Pending approvals</p>
                <p className="my-booking-hero__meta-value">{pendingCoaches.length}</p>
              </div>
            </div>
          </div>
            <div className="my-booking-hero__cta">
              <div className="my-booking-hero__badge">Lightning-fast booking</div>
              <p>Skip discovery mode—this page is built to confirm your next lesson quickly.</p>
            </div>
          </header>

          <section className="my-booking-toolbar" aria-label="Quick booking filters">
            <div className="my-booking-toolbar__controls">
              <form className="coach-search" role="search" onSubmit={(event) => event.preventDefault()}>
                <Search size={16} aria-hidden />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search your coaches…"
                  aria-label="Search my coaches by name"
                />
                {search ? (
                  <button type="button" className="coach-search-clear" onClick={() => setSearch("")}>
                    <span className="sr-only">Clear search</span>
                    ×
                  </button>
                ) : null}
              </form>
              <button type="button" className="refresh-button" onClick={fetchCoaches} disabled={loading}>
                {loading ? <Loader2 className="spin" size={16} aria-hidden /> : <RefreshCcw size={16} aria-hidden />}
                Refresh availability
              </button>
            </div>
            <p className="my-booking-toolbar__hint">Select a time on any card to activate the booking button.</p>
          </section>

          {error && <StateBanner tone="error" title="Couldn’t load coaches" message={error} />}

          {loading && (
            <div className="my-coaches__grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="my-coaches__skeleton" />
              ))}
            </div>
          )}

          {showEmpty && (
            <StateBanner
              tone="empty"
              title="No coaches in your roster"
              message="Once you start working with coaches, they’ll appear here."
            />
          )}

          {!loading && !error && filteredConfirmed.length > 0 && (
            <section className="my-coaches__grid" aria-label="Connected coaches">
              {filteredConfirmed.map((coach) => (
                <MyCoachBookingCard key={pickCoachId(coach) ?? resolveName(coach)} coach={coach} authToken={playerToken} />
              ))}
            </section>
          )}

          {!loading && !error && pendingCoaches.length > 0 && (
            <section className="pending-coaches" aria-labelledby="pending-coaches-heading">
              <div className="coach-section-header">
                <h3 id="pending-coaches-heading">Pending Approval</h3>
                <p>Requests that are awaiting coach confirmation.</p>
              </div>
              <ul className="pending-coaches__list">
                {pendingCoaches.map((coach) => (
                  <PendingCoachRow key={pickCoachId(coach) ?? resolveName(coach)} coach={coach} />
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default MyCoachesPage;
