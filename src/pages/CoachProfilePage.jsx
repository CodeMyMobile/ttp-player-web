import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
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

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const buildCalendarDays = (monthDate) => {
  const monthStart = startOfMonth(monthDate);
  const startDay = monthStart.getDay();
  const firstCell = addDays(monthStart, -startDay);
  return Array.from({ length: 42 }, (_, index) => {
    const current = addDays(firstCell, index);
    return {
      date: current,
      iso: formatDateKey(current),
    };
  });
};

const parseIsoDate = (iso) => {
  if (!iso) return null;
  const parts = iso.split("-").map((part) => Number(part));
  if (parts.length < 3) return null;
  const [year, month, day] = parts;
  if ([year, month, day].some((value) => Number.isNaN(value))) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const formatDateDisplay = (iso) => {
  const date = parseIsoDate(iso);
  if (!date) return iso || "";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
};

const formatMonthYear = (date) =>
  new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);

const convertMeridiemTo24 = (value) => {
  if (!value) return null;
  const text = value.toString().trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return null;
  const [, hourRaw, minute, secondRaw = "00", meridiemRaw] = match;
  let hour = Number(hourRaw);
  if (Number.isNaN(hour)) return null;
  const meridiem = meridiemRaw.toUpperCase();
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (meridiem === "PM" && hour !== 12) hour += 12;
  const second = secondRaw || "00";
  return `${String(hour).padStart(2, "0")}:${minute}:${second}`;
};

const parseTimeForDate = (value, dateIso) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = value.toString().trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const baseDate = parseIsoDate(dateIso);
  if (!baseDate) return null;
  const baseDateString = formatDateKey(baseDate);
  const meridiem = convertMeridiemTo24(text);
  if (meridiem) {
    const candidate = new Date(`${baseDateString}T${meridiem}`);
    if (!Number.isNaN(candidate.getTime())) return candidate;
  }
  if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(text)) {
    const normalized = text.length === 5 ? `${text}:00` : text;
    const candidate = new Date(`${baseDateString}T${normalized}`);
    if (!Number.isNaN(candidate.getTime())) return candidate;
  }
  return null;
};

const formatTimeDisplay = (value, dateIso) => {
  const parsed = parseTimeForDate(value, dateIso);
  if (parsed) {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(parsed);
  }
  if (!value) return "";
  return value.toString();
};

const formatSlotLabel = (slot, dateIso) => {
  if (!slot) return "Available";
  const label = slot.label ? slot.label.toString().trim() : "";
  if (label) return label;
  const startDisplay = formatTimeDisplay(slot.start, dateIso);
  const endDisplay = formatTimeDisplay(slot.end, dateIso);
  if (startDisplay && endDisplay) {
    return `${startDisplay} – ${endDisplay}`;
  }
  if (startDisplay) return startDisplay;
  return "Available";
};

const formatMonthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const monthKeyToValue = (key) => {
  if (!key) return null;
  const [yearRaw, monthRaw] = key.split("-").map((part) => Number(part));
  if (Number.isNaN(yearRaw) || Number.isNaN(monthRaw)) return null;
  return yearRaw * 12 + (monthRaw - 1);
};

const monthValue = (date) => date.getFullYear() * 12 + date.getMonth();

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

  const availableLessonCategories = useMemo(() => {
    const order = ["private", "group", "other"];
    return order.filter((category) => (lessonsByCategory[category] || []).length > 0);
  }, [lessonsByCategory]);

  const [selectedCategory, setSelectedCategory] = useState(
    availableLessonCategories[0] ?? "private",
  );

  useEffect(() => {
    if (!availableLessonCategories.length) {
      setSelectedCategory("private");
      return;
    }
    if (!availableLessonCategories.includes(selectedCategory)) {
      setSelectedCategory(availableLessonCategories[0]);
    }
  }, [availableLessonCategories, selectedCategory]);

  const selectedLessons = useMemo(
    () => lessonsByCategory[selectedCategory] || [],
    [lessonsByCategory, selectedCategory],
  );

  const [selectedLessonId, setSelectedLessonId] = useState(
    selectedLessons[0]?.id ?? "",
  );

  useEffect(() => {
    if (!selectedLessons.length) {
      if (selectedLessonId) setSelectedLessonId("");
      return;
    }
    if (!selectedLessons.some((lesson) => lesson.id === selectedLessonId)) {
      setSelectedLessonId(selectedLessons[0].id);
    }
  }, [selectedLessons, selectedLessonId]);
  const highlightItems = useMemo(() => {
    if (!coach) return [];
    const items = [];
    if (coach.hourlyRate) {
      items.push({
        id: "rate",
        label: "Price",
        value: coach.hourlyRate,
        helper: "Per hour",
        icon: DollarSign,
      });
    }
    const privateLesson = lessonsByCategory.private?.[0];
    if (privateLesson) {
      items.push({
        id: "private",
        label: "Private",
        value: privateLesson.label,
        helper: privateLesson.description || "1-on-1 training",
        icon: UserRound,
      });
    }
    if (coach.responseTime || coach.availability) {
      items.push({
        id: "response",
        label: coach.responseTime ? "Response time" : "Next availability",
        value: coach.responseTime || coach.availability,
        icon: Clock,
      });
    }
    if (typeof coach.studentsCount === "number" && coach.studentsCount > 0) {
      items.push({
        id: "students",
        label: "Students",
        value: coach.studentsCount.toLocaleString(),
        helper: "Players coached",
        icon: Users2,
      });
    } else if (typeof coach.lessonsCount === "number" && coach.lessonsCount > 0) {
      items.push({
        id: "lessons",
        label: "Lessons",
        value: coach.lessonsCount.toLocaleString(),
        helper: "Sessions taught",
        icon: Users2,
      });
    }
    const locationCount = Array.isArray(coach.locationPlaces)
      ? coach.locationPlaces.length
      : Array.isArray(coach.locationList)
        ? coach.locationList.length
        : 0;
    if (locationCount) {
      items.push({
        id: "locations",
        label: locationCount === 1 ? "Location" : "Locations",
        value: locationCount.toString(),
        helper: locationCount === 1 ? primaryLocation : "Coaching sites",
        icon: MapPin,
      });
    }
    return items.slice(0, 5);
  }, [coach, lessonsByCategory, primaryLocation]);

  const summaryItems = useMemo(() => {
    const items = [];
    if (primaryLocation) {
      items.push({ icon: MapPin, label: primaryLocation });
    }
    if (coach?.availability) {
      items.push({ icon: Calendar, label: coach.availability });
    }
    if (typeof coach?.lessonsCount === "number" && coach.lessonsCount > 0) {
      items.push({
        icon: Users2,
        label: `${coach.lessonsCount.toLocaleString()} lessons taught`,
      });
    }
    return items;
  }, [coach?.availability, coach?.lessonsCount, primaryLocation]);

  const certifications = coach?.certifications ?? [];

  const availabilityEntries = useMemo(
    () =>
      Array.isArray(coach?.availabilityCalendar)
        ? coach.availabilityCalendar
        : [],
    [coach?.availabilityCalendar],
  );

  const availabilityMap = useMemo(() => {
    const map = new Map();
    availabilityEntries.forEach((entry) => {
      if (!entry || typeof entry !== "object" || !entry.date) return;
      const slots = Array.isArray(entry.slots) ? entry.slots.filter(Boolean) : [];
      map.set(entry.date, {
        date: entry.date,
        slots,
      });
    });
    return map;
  }, [availabilityEntries]);

  const availableDates = useMemo(() => {
    const dates = Array.from(availabilityMap.keys());
    dates.sort();
    return dates;
  }, [availabilityMap]);

  const availableMonthKeys = useMemo(() => {
    const set = new Set();
    availableDates.forEach((iso) => {
      const parsed = parseIsoDate(iso);
      if (parsed) {
        set.add(formatMonthKey(parsed));
      }
    });
    return Array.from(set).sort();
  }, [availableDates]);

  const minMonthValue = useMemo(
    () => (availableMonthKeys.length ? monthKeyToValue(availableMonthKeys[0]) : null),
    [availableMonthKeys],
  );

  const maxMonthValue = useMemo(
    () =>
      availableMonthKeys.length
        ? monthKeyToValue(availableMonthKeys[availableMonthKeys.length - 1])
        : null,
    [availableMonthKeys],
  );

  const fallbackDateKey = useMemo(() => formatDateKey(new Date()), []);
  const initialMonthKey = availableDates[0] ?? fallbackDateKey;

  const [currentMonth, setCurrentMonth] = useState(() => {
    const parsed = parseIsoDate(initialMonthKey);
    return startOfMonth(parsed ?? new Date());
  });

  useEffect(() => {
    const parsed = parseIsoDate(initialMonthKey);
    setCurrentMonth((prev) => {
      const next = startOfMonth(parsed ?? new Date());
      return next.getTime() === prev.getTime() ? prev : next;
    });
  }, [initialMonthKey]);

  const calendarDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const todayIso = useMemo(() => formatDateKey(new Date()), []);

  const [selectedDate, setSelectedDate] = useState(() => availableDates[0] ?? "");

  useEffect(() => {
    if (!availableDates.length) {
      if (selectedDate) setSelectedDate("");
      return;
    }
    if (!selectedDate || !availableDates.includes(selectedDate)) {
      setSelectedDate(availableDates[0]);
    }
  }, [availableDates, selectedDate]);

  const selectedAvailability = selectedDate ? availabilityMap.get(selectedDate) : null;
  const hasAvailability = availabilityEntries.length > 0;

  const prevMonthCandidate = useMemo(() => {
    const date = new Date(currentMonth);
    date.setMonth(date.getMonth() - 1);
    return date;
  }, [currentMonth]);

  const nextMonthCandidate = useMemo(() => {
    const date = new Date(currentMonth);
    date.setMonth(date.getMonth() + 1);
    return date;
  }, [currentMonth]);

  const canGoPrev =
    minMonthValue === null ? false : monthValue(prevMonthCandidate) >= minMonthValue;
  const canGoNext =
    maxMonthValue === null ? false : monthValue(nextMonthCandidate) <= maxMonthValue;

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => {
      const candidate = new Date(prev);
      candidate.setMonth(candidate.getMonth() - 1);
      if (minMonthValue === null || monthValue(candidate) < minMonthValue) {
        return prev;
      }
      return candidate;
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => {
      const candidate = new Date(prev);
      candidate.setMonth(candidate.getMonth() + 1);
      if (maxMonthValue === null || monthValue(candidate) > maxMonthValue) {
        return prev;
      }
      return candidate;
    });
  };

  const handleSelectDay = (iso, isAvailable) => {
    if (!isAvailable) return;
    setSelectedDate(iso);
  };

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
        <div className="coach-profile-content">
          <section className="coach-profile-hero">
            <div className="coach-profile-hero-card">
              <div className="coach-profile-hero-main">
                <div className="coach-profile-identity">
                  <div className="coach-profile-avatar" aria-hidden={coach.avatar ? undefined : true}>
                    {coach.avatar ? (
                      <img src={coach.avatar} alt={coach.name} loading="lazy" />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>
                  <div className="coach-profile-identity-body">
                    <div className="coach-profile-name-row">
                      <div className="coach-profile-name-group">
                        <h1>{coach.name}</h1>
                        {coach.badge ? (
                          <span className="coach-profile-badge">{coach.badge}</span>
                        ) : null}
                      </div>
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
                            <span className="coach-profile-rating-count">
                              ({ratingCountDisplay} reviews)
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {summaryItems.length ? (
                      <ul className="coach-profile-summary">
                        {summaryItems.map((item, index) => {
                          const Icon = item.icon;
                          return (
                            <li key={`${item.label}-${index}`}>
                              <Icon size={16} aria-hidden />
                              <span>{item.label}</span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                    {coach.bio ? <p className="coach-profile-bio">{coach.bio}</p> : null}
                    {certifications.length ? (
                      <div className="coach-profile-certifications" role="list">
                        {certifications.map((cert) => (
                          <span className="coach-profile-certification" key={cert} role="listitem">
                            {cert}
                          </span>
                        ))}
                      </div>
                    ) : null}
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
                {highlightItems.length ? (
                  <div className="coach-profile-highlights">
                    {highlightItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div className="coach-profile-highlight" key={item.id}>
                          <div className="coach-profile-highlight-icon">
                            <Icon size={16} aria-hidden />
                          </div>
                          <div className="coach-profile-highlight-body">
                            <span className="coach-profile-highlight-value">{item.value}</span>
                            <span className="coach-profile-highlight-label">{item.label}</span>
                            {item.helper ? (
                              <span className="coach-profile-highlight-helper">{item.helper}</span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <div className="coach-profile-body">
            <div className="coach-profile-main-column">
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
                <h2>Lesson Types</h2>
                {coach.lessonTypes && coach.lessonTypes.length ? (
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
                <section className="coach-profile-availability-card">
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

            <aside className="coach-profile-booking">
              <section className="coach-profile-booking-card">
                <header className="coach-profile-booking-header">
                  <div>
                    <h2>Book a Lesson</h2>
                    <p>Select a lesson type and review upcoming availability.</p>
                  </div>
                </header>

                <div className="coach-profile-booking-section">
                  <h3>Lesson type</h3>
                  {availableLessonCategories.length ? (
                    <div className="coach-profile-lesson-toggle" role="tablist">
                      {availableLessonCategories.map((category) => {
                        const isActive = selectedCategory === category;
                        const meta = lessonCategoryContent[category];
                        return (
                          <button
                            key={category}
                            type="button"
                            className={`coach-profile-lesson-pill${isActive ? " active" : ""}`}
                            onClick={() => setSelectedCategory(category)}
                            role="tab"
                            aria-selected={isActive}
                          >
                            {meta.title.replace(/ Lessons$/, "")}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="coach-profile-empty">
                      Lesson offerings will appear here as the coach adds them.
                    </p>
                  )}
                </div>

                {selectedLessons.length ? (
                  <div className="coach-profile-lesson-options">
                    {selectedLessons.map((lesson) => {
                      const isActive = selectedLessonId === lesson.id;
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          className={`coach-profile-lesson-option${isActive ? " active" : ""}`}
                          onClick={() => setSelectedLessonId(lesson.id)}
                        >
                          <span className="coach-profile-lesson-option-label">{lesson.label}</span>
                          {lesson.description ? (
                            <span className="coach-profile-lesson-option-description">
                              {lesson.description}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className="coach-profile-calendar">
                  <div className="coach-profile-calendar-header">
                    <button
                      type="button"
                      className="coach-profile-calendar-nav"
                      onClick={handlePrevMonth}
                      disabled={!canGoPrev}
                      aria-label="Previous month"
                    >
                      <ChevronLeft size={18} aria-hidden />
                    </button>
                    <div className="coach-profile-calendar-month">{formatMonthYear(currentMonth)}</div>
                    <button
                      type="button"
                      className="coach-profile-calendar-nav"
                      onClick={handleNextMonth}
                      disabled={!canGoNext}
                      aria-label="Next month"
                    >
                      <ChevronRight size={18} aria-hidden />
                    </button>
                  </div>
                  <div className="coach-profile-calendar-weekdays">
                    {WEEKDAY_LABELS.map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>
                  <div className="coach-profile-calendar-days" role="grid">
                    {calendarDays.map(({ date, iso }) => {
                      const isAvailable = availabilityMap.has(iso);
                      const isSelected = selectedDate === iso;
                      const isOutside = date.getMonth() !== currentMonth.getMonth();
                      const isToday = iso === todayIso;
                      const slotCount = availabilityMap.get(iso)?.slots?.length ?? 0;
                      const dayClasses = [
                        "coach-profile-calendar-day",
                        isOutside ? "is-outside" : "",
                        isAvailable ? "is-available" : "",
                        isSelected ? "is-selected" : "",
                        isToday ? "is-today" : "",
                      ]
                        .filter(Boolean)
                        .join(" ");
                      const ariaLabel = `${formatDateDisplay(iso)}${
                        slotCount
                          ? ` – ${slotCount} time${slotCount > 1 ? "s" : ""} available`
                          : ""
                      }`;
                      return (
                        <button
                          key={iso}
                          type="button"
                          className={dayClasses}
                          onClick={() => handleSelectDay(iso, isAvailable)}
                          disabled={!isAvailable}
                          aria-pressed={isSelected}
                          aria-label={ariaLabel}
                        >
                          <span>{date.getDate()}</span>
                          {isAvailable ? (
                            <span className="coach-profile-calendar-dot" aria-hidden />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="coach-profile-calendar-footer">
                  <h3>Available times</h3>
                  {selectedDate ? (
                    <p className="coach-profile-calendar-selected-date">
                      {formatDateDisplay(selectedDate)}
                    </p>
                  ) : null}
                  {hasAvailability ? (
                    selectedDate && selectedAvailability?.slots?.length ? (
                      <ul className="coach-profile-slots">
                        {selectedAvailability.slots.map((slot, index) => (
                          <li key={`${slot.start ?? slot.label ?? index}`}>
                            {formatSlotLabel(slot, selectedDate)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="coach-profile-no-slots">
                        {selectedDate
                          ? "No times posted for this day yet."
                          : "Select a highlighted date to view available times."}
                      </p>
                    )
                  ) : (
                    <p className="coach-profile-no-slots">
                      This coach hasn&apos;t shared upcoming availability yet.
                    </p>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CoachProfilePage;
