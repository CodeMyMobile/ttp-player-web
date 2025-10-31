import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Loader2,
  MapPin,
  Sparkles,
  Star,
  UserRound,
  Users2,
} from "lucide-react";
import api, { unwrap } from "../services/api";
import { normalizeCoach } from "../utils/coachNormalization";
import "./CoachProfilePage.css";

const hasCoachIndicators = (value) => {
  if (!value || typeof value !== "object") return false;
  return [
    "id",
    "coach_id",
    "player_coach_id",
    "user_id",
    "uuid",
    "slug",
    "username",
    "name",
    "full_name",
    "first_name",
    "last_name",
  ].some((key) => Object.prototype.hasOwnProperty.call(value, key));
};

const matchesCoachParam = (coach, rawParam) => {
  if (!coach || !rawParam) return false;
  const identifiers = [
    coach.slug,
    coach.id,
    coach.coach_id,
    coach.user_id,
    coach.player_coach_id,
    coach.uuid,
  ]
    .filter((item) => item !== undefined && item !== null)
    .map((item) => item.toString().toLowerCase());
  const normalizedParam = rawParam.toString().toLowerCase();
  return identifiers.includes(normalizedParam);
};

const pickCoachFromResponse = (payload, matcher) => {
  if (payload === null || payload === undefined) return null;
  if (Array.isArray(payload)) {
    if (!payload.length) return null;
    if (matcher) {
      const normalizedMatcher = matcher.toString().toLowerCase();
      for (const item of payload) {
        if (item && typeof item === "object") {
          const identifiers = [
            item.id,
            item.coach_id,
            item.player_coach_id,
            item.user_id,
            item.uuid,
            item.slug,
            item.username,
            item.handle,
          ]
            .filter((value) => value !== undefined && value !== null)
            .map((value) => value.toString().toLowerCase());
          if (identifiers.includes(normalizedMatcher)) {
            return item;
          }
        }
      }
    }
    for (const item of payload) {
      if (hasCoachIndicators(item)) return item;
    }
    return null;
  }

  if (typeof payload === "object") {
    if (hasCoachIndicators(payload)) {
      if (!matcher) return payload;
      const normalizedMatcher = matcher.toString().toLowerCase();
      const identifiers = [
        payload.id,
        payload.coach_id,
        payload.player_coach_id,
        payload.user_id,
        payload.uuid,
        payload.slug,
        payload.username,
        payload.handle,
      ]
        .filter((value) => value !== undefined && value !== null)
        .map((value) => value.toString().toLowerCase());
      if (!identifiers.length || identifiers.includes(normalizedMatcher)) {
        return payload;
      }
    }

    const candidateKeys = [
      "coach",
      "profile",
      "data",
      "result",
      "results",
      "entry",
      "item",
      "details",
      "payload",
      "record",
      "response",
    ];

    for (const key of candidateKeys) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        const nested = pickCoachFromResponse(payload[key], matcher);
        if (nested) return nested;
      }
    }
  }

  return null;
};

const groupLessonTypes = (lessonTypes) => {
  const groups = {
    private: [],
    group: [],
    other: [],
  };
  if (!Array.isArray(lessonTypes)) return groups;
  lessonTypes.forEach((lesson) => {
    if (!lesson || typeof lesson !== "object") return;
    const category =
      lesson.category === "private" || lesson.category === "group"
        ? lesson.category
        : "other";
    groups[category].push(lesson);
  });
  return groups;
};

const lessonCategoryContent = {
  private: {
    title: "Private Lessons",
    description: "One-on-one instruction tailored to your game.",
    icon: UserRound,
  },
  group: {
    title: "Group Lessons",
    description: "Train alongside others in small groups.",
    icon: Users2,
  },
  other: {
    title: "Additional Programs",
    description: "Clinics, camps, and specialty sessions.",
    icon: Sparkles,
  },
};

const CoachProfilePage = () => {
  const { coachId } = useParams();
  const location = useLocation();
  const initialCoach = location.state?.coach;
  const [coach, setCoach] = useState(() =>
    initialCoach && matchesCoachParam(initialCoach, coachId) ? initialCoach : null,
  );
  const [loading, setLoading] = useState(!coach);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    const loadCoach = async () => {
      const hasInitial = initialCoach && matchesCoachParam(initialCoach, coachId);
      if (!hasInitial) {
        setCoach(null);
        setLoading(true);
      } else {
        setCoach(initialCoach);
        setRefreshing(true);
      }
      setError("");
      try {
        const response = await unwrap(
          api(`/player/coaches/${encodeURIComponent(coachId)}`, {
            method: "GET",
          }),
        );
        if (ignore) return;
        const picked = pickCoachFromResponse(response, coachId);
        if (!picked) {
          setCoach(hasInitial ? initialCoach : null);
          setError("We couldn't find this coach profile.");
        } else {
          setCoach(normalizeCoach(picked));
        }
      } catch (err) {
        if (ignore) return;
        console.error("Failed to load coach profile", err);
        setError(
          err?.data?.error || err?.message || "We couldn't load this coach profile right now.",
        );
      } finally {
        if (!ignore) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    loadCoach();
    return () => {
      ignore = true;
    };
  }, [coachId, initialCoach]);

  useEffect(() => {
    if (coach?.name) {
      document.title = `${coach.name} • Coach Profile | TTP`;
    } else {
      document.title = "Coach Profile | TTP";
    }
  }, [coach?.name]);

  const initials = useMemo(() => {
    if (!coach?.name) return "C";
    const parts = coach.name.split(/\s+/).filter(Boolean);
    if (!parts.length) return "C";
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
    return `${first}${last}`.toUpperCase();
  }, [coach?.name]);

  const ratingDisplay = useMemo(() => {
    if (typeof coach?.ratingValue !== "number") return null;
    const value = coach.ratingValue;
    const rounded = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
    return rounded;
  }, [coach?.ratingValue]);

  const ratingCountDisplay = useMemo(() => {
    if (typeof coach?.ratingCount !== "number") return null;
    return coach.ratingCount.toLocaleString();
  }, [coach?.ratingCount]);

  const primaryLocation = useMemo(() => {
    if (Array.isArray(coach?.locationPlaces) && coach.locationPlaces.length) {
      return coach.locationPlaces[0].label;
    }
    if (Array.isArray(coach?.locationList) && coach.locationList.length) {
      return coach.locationList[0];
    }
    return null;
  }, [coach?.locationList, coach?.locationPlaces]);

  const lessonsByCategory = useMemo(
    () => groupLessonTypes(coach?.lessonTypes || []),
    [coach?.lessonTypes],
  );

  const lessonsAvailable =
    lessonsByCategory.private.length +
    lessonsByCategory.group.length +
    lessonsByCategory.other.length;

  return (
    <div className="coach-profile-page">
      <div className="coach-profile-back">
        <Link to="/coaches" className="coach-profile-backlink">
          <ArrowLeft size={18} aria-hidden />
          <span>Back to Coaches</span>
        </Link>
      </div>
      {loading ? (
        <div className="coach-profile-loading" role="status" aria-live="polite">
          <Loader2 size={32} className="coach-profile-spinner" aria-hidden />
          <span>Loading coach profile…</span>
        </div>
      ) : error && !coach ? (
        <div className="coach-profile-error">
          <h1>We couldn&apos;t load this coach</h1>
          <p>{error}</p>
          <Link to="/coaches" className="coach-profile-error-link">
            Browse available coaches
          </Link>
        </div>
      ) : coach ? (
        <>
          <section className="coach-profile-hero">
            <div className="coach-profile-hero-card">
              <div className="coach-profile-hero-main">
                <div className="coach-profile-avatar" aria-hidden={coach.avatar ? undefined : true}>
                  {coach.avatar ? (
                    <img src={coach.avatar} alt={coach.name} loading="lazy" />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div className="coach-profile-headline">
                  <div className="coach-profile-name-row">
                    <h1>{coach.name}</h1>
                    {ratingDisplay ? (
                      <div
                        className="coach-profile-rating"
                        aria-label={`Rated ${ratingDisplay} out of 5${
                          ratingCountDisplay ? ` from ${ratingCountDisplay} reviews` : ""
                        }`}
                      >
                        <Star size={18} aria-hidden />
                        <span>{ratingDisplay}</span>
                        {ratingCountDisplay ? (
                          <span className="coach-profile-rating-count">({ratingCountDisplay})</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {coach.hourlyRate ? (
                    <p className="coach-profile-rate">{coach.hourlyRate}</p>
                  ) : null}
                  {coach.bio ? <p className="coach-profile-bio">{coach.bio}</p> : null}
                  <ul className="coach-profile-meta">
                    {primaryLocation ? (
                      <li>
                        <MapPin size={16} aria-hidden />
                        <span>{primaryLocation}</span>
                      </li>
                    ) : null}
                    {coach.availability ? (
                      <li>
                        <Calendar size={16} aria-hidden />
                        <span>{coach.availability}</span>
                      </li>
                    ) : null}
                    {typeof coach.lessonsCount === "number" && coach.lessonsCount > 0 ? (
                      <li>
                        <Users2 size={16} aria-hidden />
                        <span>{coach.lessonsCount.toLocaleString()} lessons taught</span>
                      </li>
                    ) : null}
                  </ul>
                  <div className="coach-profile-actions">
                    <button type="button" className="coach-profile-cta" disabled={refreshing}>
                      {refreshing ? (
                        <Loader2 size={16} className="coach-profile-cta-spinner" aria-hidden />
                      ) : null}
                      Send Roster Request
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="coach-profile-grid">
            <section className="coach-profile-section">
              <h2>Specialties</h2>
              {Array.isArray(coach.specialties) && coach.specialties.length ? (
                <div className="coach-profile-chips" role="list">
                  {coach.specialties.map((specialty) => (
                    <span className="coach-profile-chip" role="listitem" key={specialty}>
                      {specialty}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="coach-profile-empty">Specialties will appear here once added.</p>
              )}
            </section>

            <section className="coach-profile-section">
              <h2>Coaching Locations</h2>
              {Array.isArray(coach.locationPlaces) && coach.locationPlaces.length ? (
                <ul className="coach-profile-locations">
                  {coach.locationPlaces.map((locationEntry) => (
                    <li key={locationEntry.id}>
                      <MapPin size={16} aria-hidden />
                      <span>{locationEntry.label}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="coach-profile-empty">Coaching locations are coming soon.</p>
              )}
            </section>

            <section className="coach-profile-section">
              <h2>Available Lesson Types</h2>
              {lessonsAvailable ? (
                <div className="coach-profile-lessons">
                  {Object.entries(lessonCategoryContent).map(([key, meta]) => {
                    const entries = lessonsByCategory[key] || [];
                    if (!entries.length) return null;
                    const Icon = meta.icon;
                    return (
                      <div className="coach-profile-lesson-card" key={key}>
                        <div className="coach-profile-lesson-header">
                          <div className="coach-profile-lesson-icon">
                            <Icon size={18} aria-hidden />
                          </div>
                          <div>
                            <h3>{meta.title}</h3>
                            <p>{meta.description}</p>
                          </div>
                        </div>
                        <ul>
                          {entries.map((lesson) => (
                            <li key={lesson.id}>{lesson.label}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="coach-profile-empty">
                  Lesson offerings will appear here as the coach adds them.
                </p>
              )}
            </section>

            {coach.typicalAvailability ? (
              <section className="coach-profile-availability">
                <div className="coach-profile-availability-icon">
                  <Calendar size={20} aria-hidden />
                </div>
                <div>
                  <h2>Typical availability</h2>
                  <p>{coach.typicalAvailability}</p>
                </div>
              </section>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default CoachProfilePage;
