import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  Share2,
  Users,
} from "lucide-react";
import moment from "moment";

import {
  fetchUpcomingGroupLessons,
  fetchUpcomingGroupLessonById,
  mapUpcomingGroupLesson,
  mapUpcomingGroupLessonsResponse,
  type GroupLesson,
} from "../api/groupLessons";
import MainLayout from "../components/MainLayout";
import { colors, typography } from "../lib/theme";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";
import { DEFAULT_POSITION, getStoredLocation } from "../utils/userLocation";

import "./GroupLessonDetailsPage.css";

const parseTimeToMinutes = (timeLabel: string) => {
  const match = timeLabel.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return null;
  }

  const [, hourPart, minutePart, periodRaw] = match;
  let hours = Number.parseInt(hourPart, 10);
  const minutes = Number.parseInt(minutePart, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  const period = periodRaw.toUpperCase();
  hours %= 12;
  if (period === "PM") {
    hours += 12;
  }

  return hours * 60 + minutes;
};

const formatMinutesToTimeLabel = (totalMinutes: number) => {
  const minutesNormalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours24 = Math.floor(minutesNormalized / 60);
  const minutes = minutesNormalized % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
};

const buildTimeRangeLabel = (startLabel: string, durationMinutes: number) => {
  const startMinutes = parseTimeToMinutes(startLabel);
  if (startMinutes == null) {
    return startLabel;
  }

  const endMinutes = startMinutes + durationMinutes;
  return `${formatMinutesToTimeLabel(startMinutes)} – ${formatMinutesToTimeLabel(endMinutes)}`;
};

const formatLevel = (level: number) => `NTRP ${level.toFixed(1)}`;

const buildInitials = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) {
    return "";
  }
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

type GroupLessonsStateSnapshot = {
  coachFilter: string;
  levelFilter: string;
  formatFilter: string;
  selectedRadius: string;
  searchTerm: string;
  dateFilter:
    | { type: "all" }
    | { type: "day"; iso: string }
    | { type: "range"; start: string; end: string };
  rangeStartValue: string;
  rangeEndValue: string;
  useLocationFilter: boolean;
  sortBy: "soonest" | "price-low" | "price-high";
  locationFilter: {
    label: string;
    latitude: number;
    longitude: number;
    isCurrentLocation?: boolean;
  } | null;
  locationSearchTerm: string;
};

type GroupLessonDetailsRouteState = {
  groupLessonsState?: GroupLessonsStateSnapshot;
};

const GroupLessonDetailsPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lesson, setLesson] = useState<GroupLesson | null>(null);
  const [relatedLessons, setRelatedLessons] = useState<GroupLesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const routeState = (location.state as GroupLessonDetailsRouteState | null | undefined) ?? null;
  const groupLessonsReturnState = routeState?.groupLessonsState ?? null;
  const goBackToGroupLessons = useCallback(() => {
    navigate("/group-lessons", {
      state: groupLessonsReturnState ? { groupLessonsState: groupLessonsReturnState } : undefined,
    });
  }, [groupLessonsReturnState, navigate]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadLesson = async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }
      const token = getStoredAuthToken({ preferScheme: "token" });
      if (!token) {
        setLoadError("Missing authentication token.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        try {
          const response = await fetchUpcomingGroupLessonById({
            token,
            lessonId: id,
            signal: controller.signal,
          });

          if (cancelled) return;

          setLesson(mapUpcomingGroupLesson(response.lesson));
        } catch (error) {
          if (cancelled) return;
          const position = getStoredLocation() ?? DEFAULT_POSITION;
          const fallbackResponse = await fetchUpcomingGroupLessons({
            token,
            perPage: 50,
            page: 1,
            position,
            signal: controller.signal,
          });

          if (cancelled) return;

          const mapped = mapUpcomingGroupLessonsResponse(fallbackResponse);
          const found = mapped.lessons.find((item) => item.id === String(id));
          setLesson(found ?? null);
        }
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load lesson.");
        setLesson(null);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadLesson();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id]);

  useEffect(() => {
    if (!lesson) {
      setRelatedLessons([]);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const loadRelatedLessons = async () => {
      const token = getStoredAuthToken({ preferScheme: "token" });
      if (!token) {
        setRelatedLessons([]);
        return;
      }

      try {
        const response = await fetchUpcomingGroupLessons({
          token,
          perPage: 50,
          page: 1,
          position: getStoredLocation() ?? DEFAULT_POSITION,
          signal: controller.signal,
        });

        if (cancelled) return;

        const mapped = mapUpcomingGroupLessonsResponse(response).lessons
          .filter(
            (candidate) =>
              candidate.id !== lesson.id &&
              candidate.title === lesson.title &&
              candidate.coachId === lesson.coachId,
          )
          .sort((left, right) => {
            const leftTime = left.startDateTime ? new Date(left.startDateTime).getTime() : Number.MAX_SAFE_INTEGER;
            const rightTime = right.startDateTime ? new Date(right.startDateTime).getTime() : Number.MAX_SAFE_INTEGER;
            return leftTime - rightTime;
          })
          .slice(0, 3);

        setRelatedLessons(mapped);
      } catch {
        if (!cancelled) {
          setRelatedLessons([]);
        }
      }
    };

    void loadRelatedLessons();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [lesson]);

  const themeVars = useMemo(
    () => ({
      "--fc-color-bg": colors.pageBackground,
      "--fc-color-surface": colors.surface,
      "--fc-color-border": colors.border,
      "--fc-color-text-primary": colors.primaryText,
      "--fc-color-text-secondary": colors.secondaryText,
      "--fc-color-text-muted": colors.mutedText,
      "--fc-color-accent": colors.accentPurple,
      "--fc-color-accent-light": colors.accentPurpleLight,
      "--fc-color-accent-border": colors.accentPurpleBorder,
      "--fc-font-family": typography.fontFamily,
    }),
    [],
  );

  const currentUserIdentity = useMemo(() => {
    const record = user as Record<string, unknown> | null;
    const sessionRecord = record?.session as Record<string, unknown> | undefined;
    let storedUserId: string | undefined;
    let storedEmail: string | undefined;
    let storedPhone: string | undefined;
    if (typeof window !== "undefined") {
      try {
        const loginRaw = localStorage.getItem("authLoginResponse");
        const profileRaw = localStorage.getItem("playerPersonalDetails");
        const login = loginRaw ? JSON.parse(loginRaw) : null;
        const profile = profileRaw ? JSON.parse(profileRaw) : null;
        const storedId =
          login?.user_id ??
          login?.profile?.user_id ??
          profile?.user_id ??
          profile?.id ??
          undefined;
        storedUserId = storedId != null ? String(storedId) : undefined;
        storedEmail =
          (login?.email as string | undefined) ??
          (profile?.email as string | undefined);
        storedPhone =
          (login?.phone as string | undefined) ??
          (profile?.phone as string | undefined);
      } catch {
        storedUserId = undefined;
        storedEmail = undefined;
        storedPhone = undefined;
      }
    }
    const candidate =
      record?.id ??
      record?.user_id ??
      record?.player_id ??
      record?.profile_id ??
      sessionRecord?.user_id ??
      sessionRecord?.id;
    const email =
      (record?.email as string | undefined) ??
      (record?.user_email as string | undefined) ??
      (sessionRecord?.email as string | undefined);
    const phone =
      (record?.phone as string | undefined) ??
      (record?.phone_number as string | undefined) ??
      (sessionRecord?.phone as string | undefined);
    return {
      id: candidate != null ? String(candidate) : storedUserId,
      email: email ? String(email).toLowerCase() : storedEmail?.toLowerCase(),
      phone: phone ? String(phone) : storedPhone ? String(storedPhone) : undefined,
    };
  }, [user]);

  const currentUserStatus = useMemo(() => {
    const groupPlayers = lesson?.groupPlayers ?? [];
    if (!groupPlayers.length) return undefined;
    const playerRecord = groupPlayers.find((player) => {
      if (currentUserIdentity.id && player.playerId != null) {
        if (String(player.playerId) === currentUserIdentity.id) return true;
      }
      if (currentUserIdentity.email && player.email) {
        if (player.email.toLowerCase() === currentUserIdentity.email) return true;
      }
      if (currentUserIdentity.phone && player.phone) {
        if (String(player.phone) === currentUserIdentity.phone) return true;
      }
      return false;
    });
    if (!playerRecord) return undefined;
    const resolved = playerRecord.paymentStatus ?? playerRecord.status;
    const parsed = typeof resolved === "number" ? resolved : Number(resolved);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [currentUserIdentity, lesson?.groupPlayers]);

  if (isLoading) {
    return (
      <MainLayout mobileChrome="home" desktopChrome="home" showDesktopNav={true}>
        <div className="group-lesson-details" style={themeVars}>
          <div className="group-lesson-details__inner group-lesson-details__inner--empty">
            <div className="group-lesson-details__empty">
              <h1>Loading session…</h1>
              <p>Hang tight while we load the details.</p>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (loadError || !lesson) {
    return (
      <MainLayout mobileChrome="home" desktopChrome="home" showDesktopNav={true}>
        <div className="group-lesson-details" style={themeVars}>
          <div className="group-lesson-details__inner group-lesson-details__inner--empty">
            <Link
              to="/group-lessons"
              state={groupLessonsReturnState ? { groupLessonsState: groupLessonsReturnState } : undefined}
              className="group-lesson-details__back-link"
            >
              <ArrowLeft aria-hidden /> Back to group lessons
            </Link>
            <div className="group-lesson-details__empty">
              <h1>{loadError ? "We couldn’t load that session" : "We couldn’t find that session"}</h1>
              <p>
                {loadError
                  ? loadError
                  : "The lesson may have been filled or removed. Browse the latest sessions to pick another time."}
              </p>
              <Link
                to="/group-lessons"
                state={groupLessonsReturnState ? { groupLessonsState: groupLessonsReturnState } : undefined}
                className="group-lesson-details__empty-action"
              >
                Explore group lessons
              </Link>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  const isBooked = currentUserStatus === 1;
  const confirmedCount = lesson.participants.length;
  const spotsRemaining = Math.max(Math.min(lesson.availableSpots, lesson.totalSpots - confirmedCount), 0);
  const timeRange = lesson.startDateTime && lesson.endDateTime
    ? (() => {
        const start = moment.utc(lesson.startDateTime);
        const end = moment.utc(lesson.endDateTime);
        if (start.isValid() && end.isValid()) {
          return `${start.format("h:mm A")} – ${end.format("h:mm A")}`;
        }
        return buildTimeRangeLabel(lesson.startTime, lesson.durationMinutes);
      })()
    : buildTimeRangeLabel(lesson.startTime, lesson.durationMinutes);
  const levelLabel = formatLevel(lesson.level);
  const dateLabel = lesson.startDateTime
    ? moment.utc(lesson.startDateTime).format("dddd, MMMM D")
    : lesson.date;
  const participantsPreview = lesson.participants.slice(0, 5);
  const hiddenParticipantsCount = Math.max(lesson.participants.length - participantsPreview.length, 0);
  const availabilityLabel =
    spotsRemaining === 0
      ? "Full — join waitlist"
      : spotsRemaining <= 2
        ? `Only ${spotsRemaining} spot${spotsRemaining === 1 ? "" : "s"} left`
        : `${spotsRemaining} spots available`;
  const availabilityToneClass =
    spotsRemaining === 0
      ? "is-full"
      : spotsRemaining <= 2
        ? "is-limited"
        : "is-open";
  const whatToBring = lesson.highlights?.length ? lesson.highlights : ["Racket", "Water", "Tennis shoes"];
  const heroBandLabel = lesson.startDateTime
    ? `${moment.utc(lesson.startDateTime).format("dddd").toUpperCase()} · ${moment
        .utc(lesson.startDateTime)
        .format("MMM D")
        .toUpperCase()}`
    : dateLabel.toUpperCase();
  const availabilityMetaLabel =
    spotsRemaining === 0
      ? "Full — join waitlist"
      : spotsRemaining <= 2
        ? `Only ${spotsRemaining} spot${spotsRemaining === 1 ? "" : "s"} left`
        : `${spotsRemaining} spots available`;
  const handleShare = async () => {
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    if (!shareUrl) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: lesson.title,
          text: `Join ${lesson.title} with ${lesson.coachName}`,
          url: shareUrl,
        });
        return;
      } catch {
        // fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // no-op fallback
    }
  };

  return (
    <MainLayout mobileChrome="home" desktopChrome="home" showDesktopNav={true}>
      <div className="group-lesson-details" style={themeVars}>
        <div className="group-lesson-details__inner">
          <div className="group-lesson-details__shell">
            <div className="group-lesson-details__topbar">
              <button
                type="button"
                className="group-lesson-details__back-link"
                onClick={goBackToGroupLessons}
              >
                <ArrowLeft aria-hidden />
                <span className="group-lesson-details__back-label">Back to group lessons</span>
              </button>
              <div className="group-lesson-details__topbar-title">Class details</div>
              <div className="group-lesson-details__topbar-actions">
                <button type="button" className="group-lesson-details__topbar-action" onClick={() => void handleShare()}>
                  <Share2 aria-hidden />
                  <span>Share</span>
                </button>
                <button
                  type="button"
                  className="group-lesson-details__topbar-close"
                  onClick={goBackToGroupLessons}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="group-lesson-details__layout">
              <section className="group-lesson-details__content">
                <header className="group-lesson-details__hero">
                  <div className="group-lesson-details__badge-row">
                    <span className="group-lesson-details__hero-badge group-lesson-details__hero-badge--primary">
                      {heroBandLabel}
                    </span>
                    <span className="group-lesson-details__hero-badge group-lesson-details__hero-badge--level">
                      {levelLabel}
                    </span>
                    <span className="group-lesson-details__hero-badge">{lesson.focus}</span>
                    {lesson.courtSurface ? (
                      <span className="group-lesson-details__hero-badge">{lesson.courtSurface} court</span>
                    ) : null}
                  </div>
                  <div className="group-lesson-details__hero-body">
                    <h1 className="group-lesson-details__hero-title">{lesson.title}</h1>
                    <p className="group-lesson-details__hero-copy">{lesson.description}</p>
                    <div className="group-lesson-details__hero-meta">
                      <div className="group-lesson-details__hero-meta-item">
                        <Clock aria-hidden />
                        <span>
                          {timeRange} · {lesson.durationMinutes} min
                        </span>
                      </div>
                      <div className="group-lesson-details__hero-meta-item">
                        <MapPin aria-hidden />
                        <span>
                          {lesson.locationName}
                          {lesson.distanceMiles > 0 ? ` · ${lesson.distanceMiles.toFixed(1)} mi` : " · nearby"}
                        </span>
                      </div>
                      <div className="group-lesson-details__hero-meta-item group-lesson-details__hero-meta-item--spots">
                        <span className="group-lesson-details__hero-emoji" aria-hidden>👥</span>
                        <span className={`group-lesson-details__hero-availability ${availabilityToneClass}`}>
                          {availabilityMetaLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                </header>

                <section className="group-lesson-details__section">
                  <h2 className="group-lesson-details__section-label">Who's joining</h2>
                  <div className="group-lesson-details__card">
                    {confirmedCount > 0 ? (
                      <>
                        <div className="group-lesson-details__participants-head">
                          <div className="group-lesson-details__participants-stack" aria-hidden>
                            {participantsPreview.map((participant) => (
                              <span
                                key={participant.id}
                                className="group-lesson-details__participants-stack-item"
                              >
                                {buildInitials(participant.name).slice(0, 1)}
                              </span>
                            ))}
                            {hiddenParticipantsCount > 0 ? (
                              <span className="group-lesson-details__participants-stack-more">
                                +{hiddenParticipantsCount}
                              </span>
                            ) : null}
                          </div>
                          <div className="group-lesson-details__participants-summary">
                            <strong>
                              {confirmedCount} of {lesson.totalSpots} players booked
                            </strong>
                            <span className={spotsRemaining > 0 ? "is-open" : "is-full"}>
                              {spotsRemaining > 0
                                ? `${spotsRemaining} spot${spotsRemaining === 1 ? "" : "s"} still open`
                                : "Class is full"}
                            </span>
                          </div>
                        </div>
                        <ul className="group-lesson-details__participants-list">
                          {lesson.participants.map((participant) => (
                            <li key={participant.id} className="group-lesson-details__participant">
                              <span className="group-lesson-details__participant-avatar" aria-hidden>
                                {participant.avatarUrl ? (
                                  <img src={participant.avatarUrl} alt="" />
                                ) : (
                                  buildInitials(participant.name)
                                )}
                              </span>
                              <div className="group-lesson-details__participant-body">
                                <span className="group-lesson-details__participant-name">{participant.name}</span>
                                <span className="group-lesson-details__participant-meta">
                                  {participant.skillLevel ?? "Skill level pending"}
                                  {participant.focusArea ? ` • ${participant.focusArea}` : ""}
                                </span>
                                {participant.joinedLabel ? (
                                  <span className="group-lesson-details__participant-joined">
                                    {participant.joinedLabel}
                                  </span>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <div className="group-lesson-details__participants-empty">
                        <p>Be the first to book. {spotsRemaining} spots are available right now.</p>
                      </div>
                    )}
                  </div>
                </section>

                <section className="group-lesson-details__section">
                  <h2 className="group-lesson-details__section-label">What to bring</h2>
                  <div className="group-lesson-details__bring-list">
                    {whatToBring.map((item) => (
                      <span key={item} className="group-lesson-details__bring-chip">
                        {item}
                      </span>
                    ))}
                  </div>
                </section>

                <section className="group-lesson-details__section">
                  <h2 className="group-lesson-details__section-label">Location</h2>
                  <div className="group-lesson-details__card">
                    <h3 className="group-lesson-details__card-title">{lesson.locationName}</h3>
                    <p className="group-lesson-details__card-copy">{lesson.locationCity}</p>
                    <ul className="group-lesson-details__location-list">
                      <li>🎾 {lesson.court ? `Court ${lesson.court}` : "Court assignment shared before class"}</li>
                      <li>📍 {lesson.distanceMiles > 0 ? `${lesson.distanceMiles.toFixed(1)} mi away` : "Nearby location"}</li>
                    </ul>
                    <a
                      className="group-lesson-details__secondary-action"
                      href={`https://maps.google.com/?q=${encodeURIComponent(lesson.locationName)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Get directions
                    </a>
                  </div>
                </section>

                <section className="group-lesson-details__section">
                  <h2 className="group-lesson-details__section-label">Your coach</h2>
                  <div className="group-lesson-details__card">
                    <div className="group-lesson-details__coach-panel">
                      {lesson.coachAvatarUrl ? (
                        <img
                          className="group-lesson-details__coach-avatar"
                          src={lesson.coachAvatarUrl}
                          alt=""
                        />
                      ) : (
                        <span className="group-lesson-details__coach-avatar--placeholder" aria-hidden>
                          {buildInitials(lesson.coachName)}
                        </span>
                      )}
                      <div className="group-lesson-details__coach-meta">
                        <p className="group-lesson-details__coach-name">{lesson.coachName}</p>
                        <div className="group-lesson-details__coach-cert-list">
                          <span className="group-lesson-details__coach-cert">Matchplay Coach</span>
                          <span className="group-lesson-details__coach-cert">{lesson.skillLabel}</span>
                        </div>
                      </div>
                    </div>
                    <p className="group-lesson-details__card-copy">
                      {lesson.focus}. Expect a clear structure, live coaching, and a strong emphasis on quality reps.
                    </p>
                    <Link to={`/coaches/${lesson.coachId}`} className="group-lesson-details__coach-link">
                      View full profile →
                    </Link>
                  </div>
                </section>

                {relatedLessons.length > 0 ? (
                  <section className="group-lesson-details__section">
                    <h2 className="group-lesson-details__section-label">Other dates for this class</h2>
                    <div className="group-lesson-details__related-list">
                      {relatedLessons.map((relatedLesson) => {
                        const relatedDateLabel = relatedLesson.startDateTime
                          ? moment.utc(relatedLesson.startDateTime).format("dddd, MMMM D")
                          : relatedLesson.date;
                        const relatedSpots = Math.max(relatedLesson.availableSpots, 0);
                        const relatedPrice = relatedLesson.pricePerPlayer.replace(" per player", "");

                        return (
                          <button
                            key={relatedLesson.id}
                            type="button"
                            className="group-lesson-details__related-card"
                            onClick={() =>
                              navigate(`/booking/confirm?groupLesson=${relatedLesson.id}`, {
                                state: {
                                  groupLessonId: relatedLesson.id,
                                  groupLessonsState: groupLessonsReturnState,
                                },
                              })
                            }
                          >
                            <div className="group-lesson-details__related-copy">
                              <strong>{relatedDateLabel.toUpperCase()}</strong>
                              <span>
                                {relatedLesson.startTime} · {relatedSpots} spot{relatedSpots === 1 ? "" : "s"} left
                              </span>
                            </div>
                            <span className="group-lesson-details__related-price">{relatedPrice}</span>
                            <span className="group-lesson-details__related-arrow" aria-hidden>
                              →
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
              </section>

              <aside className="group-lesson-details__booking-rail">
                <div className="group-lesson-details__booking-card">
                  <p className="group-lesson-details__booking-label">Book this session</p>
                  <p className="group-lesson-details__booking-price">{lesson.pricePerPlayer.replace(" per player", "")}</p>
                  <p className="group-lesson-details__booking-price-caption">per class</p>

                  <div className="group-lesson-details__booking-meta">
                    <div className="group-lesson-details__booking-meta-item">
                      <CalendarDays aria-hidden />
                      <span>{dateLabel}</span>
                    </div>
                    <div className="group-lesson-details__booking-meta-item">
                      <Clock aria-hidden />
                      <span>
                        {timeRange} · {lesson.durationMinutes} min
                      </span>
                    </div>
                    <div className="group-lesson-details__booking-meta-item">
                      <MapPin aria-hidden />
                      <span>{lesson.locationName}</span>
                    </div>
                    <div className="group-lesson-details__booking-meta-item">
                      <Users aria-hidden />
                      <span>with {lesson.coachName}</span>
                    </div>
                  </div>

                  <div className={`group-lesson-details__availability-pill ${availabilityToneClass}`}>
                    {availabilityLabel}
                  </div>

                  <div className="group-lesson-details__credit-note">
                    🎟️ Credits and saved payment methods are available at checkout
                  </div>

                  <button
                    type="button"
                    className="group-lesson-details__checkout-action"
                    disabled={spotsRemaining === 0 || isBooked}
                    onClick={() => {
                      navigate(`/booking/confirm?groupLesson=${lesson.id}`, {
                        state: {
                          groupLessonId: lesson.id,
                          groupLessonsState: groupLessonsReturnState,
                        },
                      });
                    }}
                  >
                    {isBooked ? "Booked" : spotsRemaining === 0 ? "Join waitlist" : "Book now"}
                  </button>

                  <p className="group-lesson-details__checkout-caption">
                    {spotsRemaining === 0
                      ? "We’ll notify you if a player drops and a spot re-opens."
                      : "Free cancellation up to 24 hours before the class. Your place is held as soon as checkout completes."}
                  </p>
                </div>
              </aside>
            </div>

            <div className="group-lesson-details__mobile-footer">
              <div className="group-lesson-details__mobile-footer-price">
                <strong>{lesson.pricePerPlayer.replace(" per player", "")}</strong>
                <span>per class</span>
              </div>
              <button
                type="button"
                className="group-lesson-details__mobile-footer-action"
                disabled={spotsRemaining === 0 || isBooked}
                onClick={() => {
                  navigate(`/booking/confirm?groupLesson=${lesson.id}`, {
                    state: {
                      groupLessonId: lesson.id,
                      groupLessonsState: groupLessonsReturnState,
                    },
                  });
                }}
              >
                {isBooked ? "Booked" : spotsRemaining === 0 ? "Join waitlist" : "Book now"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default GroupLessonDetailsPage;
