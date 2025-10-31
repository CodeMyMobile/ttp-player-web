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
  Star,
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
    "coach_slug",
    "coachSlug",
    "username",
    "handle",
    "profileImage",
    "price_private",
    "pricePrivate",
    "price_group",
    "priceGroup",
  ].some((key) => Object.prototype.hasOwnProperty.call(value, key));
};

const collectCoachIdentifiers = (coach) => {
  if (!coach || typeof coach !== "object") return [];
  const identifiers = [
    coach.id,
    coach.coach_id,
    coach.player_coach_id,
    coach.user_id,
    coach.uuid,
    coach.slug,
    coach.coach_slug,
    coach.coachSlug,
    coach.username,
    coach.handle,
  ]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => value.toString().toLowerCase());
  return Array.from(new Set(identifiers));
};

const matchesCoachParam = (coach, rawParam) => {
  if (!coach || rawParam === undefined || rawParam === null) return false;
  const normalized = rawParam.toString().toLowerCase();
  return collectCoachIdentifiers(coach).includes(normalized);
};

const pickCoachFromResponse = (payload, matcher) => {
  if (payload === null || payload === undefined) {
    return null;
  }

  if (Array.isArray(payload)) {
    if (!payload.length) return null;
    if (matcher !== undefined) {
      const normalized = matcher.toString().toLowerCase();
      const match = payload.find((item) => matchesCoachParam(item, normalized));
      if (match) return match;
    }
    return payload.find((item) => hasCoachIndicators(item)) ?? null;
  }

  if (typeof payload === "object") {
    if (hasCoachIndicators(payload)) {
      if (!matcher) return payload;
      return matchesCoachParam(payload, matcher) ? payload : null;
    }

    const candidateKeys = [
      "data",
      "result",
      "results",
      "coach",
      "profile",
      "item",
      "entry",
      "details",
      "payload",
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

const buildOnboardingRequests = (coachParam) => {
  const trimmed =
    coachParam === undefined || coachParam === null ? "" : coachParam.toString().trim();
  const basePath = "/coach/onboarding";
  const requests = [];
  const push = (descriptor) => {
    if (!descriptor || !descriptor.path) return;
    const key = `${descriptor.method ?? "GET"}|${descriptor.path}|${
      descriptor.json ? JSON.stringify(descriptor.json) : ""
    }`;
    if (requests.some((item) => item._key === key)) return;
    requests.push({ ...descriptor, method: (descriptor.method ?? "GET").toUpperCase(), _key: key });
  };

  if (trimmed) {
    const encoded = encodeURIComponent(trimmed);
    push({ path: `${basePath}/${encoded}` });
    push({ path: `${basePath}?slug=${encoded}` });
    push({ path: `${basePath}?coach_slug=${encoded}` });
    push({ path: `${basePath}?username=${encoded}` });
    push({ path: basePath, method: "POST", json: { slug: trimmed } });
    push({ path: basePath, method: "POST", json: { coach_slug: trimmed } });
    push({ path: basePath, method: "POST", json: { username: trimmed } });

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      push({ path: `${basePath}?coach_id=${numeric}` });
      push({ path: `${basePath}?id=${numeric}` });
      push({ path: basePath, method: "POST", json: { coach_id: numeric } });
      push({ path: basePath, method: "POST", json: { id: numeric } });
    } else {
      push({ path: basePath, method: "POST", json: { coach_id: trimmed } });
    }
  }

  return requests;
};

const parseCurrencyNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const text = value.toString().replace(/[^0-9.,-]+/g, "").trim();
  if (!text) return null;
  const normalized = text.replace(/,/g, "");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatCurrencyValue = (value) => {
  if (value === null || value === undefined) return "";
  const numeric = parseCurrencyNumber(value);
  if (numeric === null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numeric % 1 === 0 ? 0 : 2,
  }).format(numeric);
};

const formatTime = (value) => {
  if (!value) return "";
  const text = value.toString().trim();
  if (!text) return "";
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?/);
  if (!match) return text;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return text;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const formatSlotLabel = (slot, dateIso) => {
  if (!slot) return "";
  const parts = [];
  if (slot.start || slot.end) {
    const start = slot.start ? formatTime(slot.start) : null;
    const end = slot.end ? formatTime(slot.end) : null;
    const range = start && end ? `${start} – ${end}` : start || end;
    if (range) parts.push(range);
  }
  if (slot.label && !parts.length) {
    parts.push(slot.label);
  }
  if (slot.location) {
    parts.push(slot.location);
  }
  if (!parts.length && dateIso) {
    parts.push(formatDateDisplay(dateIso));
  }
  return parts.join(" • ");
};

const parseIsoDate = (iso) => {
  if (!iso) return null;
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  return new Date(year, month - 1, day);
};

const formatDateDisplay = (iso) => {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
};

const formatMonthYear = (date) =>
  date.toLocaleDateString([], { month: "long", year: "numeric" });

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
      iso: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(
        current.getDate(),
      ).padStart(2, "0")}`,
    };
  });
};

const formatMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const monthKeyToValue = (key) => {
  const match = key.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const [, year, month] = match.map(Number);
  return year * 12 + (month - 1);
};

const monthValue = (date) => date.getFullYear() * 12 + date.getMonth();

const groupLessonTypes = (lessons) => {
  const groups = {
    private: [],
    group: [],
    other: [],
  };
  if (!Array.isArray(lessons)) return groups;
  lessons.forEach((lesson) => {
    if (!lesson || typeof lesson !== "object") return;
    const category = lesson.category === "private" || lesson.category === "group" ? lesson.category : "other";
    groups[category].push(lesson);
  });
  return groups;
};

const lessonCategoryMetadata = {
  private: {
    title: "Private Lessons",
    description: "Individual instruction tailored to your goals.",
  },
  group: {
    title: "Group Lessons",
    description: "Train with others in clinics or group sessions.",
  },
  other: {
    title: "Additional Programs",
    description: "Camps, match strategy, and specialty offerings.",
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
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    const loadCoach = async () => {
      if (!coachId) {
        setCoach(null);
        setLoading(false);
        setError("We couldn't find this coach profile.");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const requests = buildOnboardingRequests(coachId);
        let resolvedCoach = null;
        let lastKnownError = null;

        for (const request of requests) {
          try {
            const response = await unwrap(
              api(request.path, {
                method: request.method,
                ...(request.json !== undefined ? { json: request.json } : {}),
              }),
            );
            if (ignore) return;
            const candidate = pickCoachFromResponse(response, coachId);
            if (candidate) {
              resolvedCoach = candidate;
              break;
            }
          } catch (requestError) {
            if (ignore) return;
            lastKnownError = requestError;
            if (requestError?.status === 404 || requestError?.status === 422) {
              continue;
            }
            throw requestError;
          }
        }

        if (!ignore) {
          if (resolvedCoach) {
            setCoach(normalizeCoach(resolvedCoach));
            setError("");
          } else if (initialCoach && matchesCoachParam(initialCoach, coachId)) {
            setCoach(initialCoach);
            setError(
              lastKnownError?.message || "We couldn't find additional details for this coach.",
            );
          } else {
            setCoach(null);
            setError(
              lastKnownError?.message || "We couldn't find this coach profile. It may be private.",
            );
          }
        }
      } catch (err) {
        if (ignore) return;
        console.error("Failed to load coach profile", err);
        setCoach((previous) => {
          if (previous && matchesCoachParam(previous, coachId)) {
            return previous;
          }
          return null;
        });
        setError(err?.message || "We couldn't load this coach profile right now.");
      } finally {
        if (!ignore) {
          setLoading(false);
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
    const parts = coach.name
      .split(" ")
      .map((part) => part.trim())
      .filter(Boolean);
    if (!parts.length) return "C";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [coach?.name]);

  const ratingDisplay = useMemo(() => {
    if (typeof coach?.ratingValue !== "number") return null;
    const value = coach.ratingValue;
    return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  }, [coach?.ratingValue]);

  const ratingCountDisplay = useMemo(() => {
    if (typeof coach?.ratingCount !== "number") return null;
    return coach.ratingCount.toLocaleString();
  }, [coach?.ratingCount]);

  const studentsDisplay = useMemo(() => {
    if (typeof coach?.studentsCount === "number" && coach.studentsCount > 0) {
      return `${coach.studentsCount.toLocaleString()} students`;
    }
    if (typeof coach?.lessonsCount === "number" && coach.lessonsCount > 0) {
      return `${coach.lessonsCount.toLocaleString()} lessons taught`;
    }
    return null;
  }, [coach?.lessonsCount, coach?.studentsCount]);

  const locationEntries = useMemo(() => {
    if (Array.isArray(coach?.locationPlaces) && coach.locationPlaces.length) {
      return coach.locationPlaces;
    }
    if (Array.isArray(coach?.locationList) && coach.locationList.length) {
      return coach.locationList.map((label, index) => ({
        id: `location-${index}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        label,
      }));
    }
    if (Array.isArray(coach?.raw?.home_courts) && coach.raw.home_courts.length) {
      return coach.raw.home_courts.map((label, index) => ({
        id: `home-${index}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        label,
      }));
    }
    return [];
  }, [coach?.locationList, coach?.locationPlaces, coach?.raw?.home_courts]);

  const summaryChips = useMemo(() => {
    const chips = [];
    if (ratingDisplay) {
      chips.push({
        id: "rating",
        icon: Star,
        label: ratingCountDisplay ? `${ratingDisplay} (${ratingCountDisplay} reviews)` : ratingDisplay,
      });
    }
    if (studentsDisplay) {
      chips.push({ id: "students", icon: Users2, label: studentsDisplay });
    }
    if (coach?.responseTime) {
      chips.push({ id: "response", icon: Clock, label: coach.responseTime });
    }
    if (locationEntries.length) {
      const suffix = locationEntries.length === 1 ? "location" : "locations";
      chips.push({ id: "locations", icon: MapPin, label: `${locationEntries.length} ${suffix}` });
    }
    return chips;
  }, [coach?.responseTime, locationEntries.length, ratingCountDisplay, ratingDisplay, studentsDisplay]);

  const privatePrice = useMemo(() => {
    const raw = coach?.raw;
    if (!raw) return null;
    return (
      parseCurrencyNumber(
        raw.price_private ?? raw.pricePrivate ?? raw.private_price ?? coach?.hourlyRateValue,
      ) ?? null
    );
  }, [coach?.hourlyRateValue, coach?.raw]);

  const semiPrivatePrice = useMemo(() => {
    const raw = coach?.raw;
    if (!raw) return null;
    return parseCurrencyNumber(raw.price_semi ?? raw.semi_private_price ?? raw.semiPrivatePrice) ?? null;
  }, [coach?.raw]);

  const groupPrice = useMemo(() => {
    const raw = coach?.raw;
    if (!raw) return null;
    return parseCurrencyNumber(raw.price_group ?? raw.group_price ?? raw.groupLessonPrice) ?? null;
  }, [coach?.raw]);

  const statCards = useMemo(() => {
    const cards = [];
    if (privatePrice !== null) {
      cards.push({
        id: "private",
        label: formatCurrencyValue(privatePrice),
        helper: "Private Lesson",
        icon: DollarSign,
      });
    }
    if (semiPrivatePrice !== null) {
      cards.push({
        id: "semi",
        label: formatCurrencyValue(semiPrivatePrice),
        helper: "Semi-private",
        icon: Users2,
      });
    }
    if (groupPrice !== null) {
      cards.push({
        id: "group",
        label: formatCurrencyValue(groupPrice),
        helper: "Group Session",
        icon: Users2,
      });
    }
    if (coach?.availability) {
      cards.push({ id: "availability", label: coach.availability, helper: "Next availability", icon: Calendar });
    } else if (coach?.responseTime && !cards.some((card) => card.id === "availability")) {
      cards.push({ id: "response", label: coach.responseTime, helper: "Response time", icon: Clock });
    }
    if (!cards.length && studentsDisplay) {
      cards.push({ id: "students", label: studentsDisplay, helper: "", icon: Users2 });
    }
    return cards.slice(0, 4);
  }, [coach?.availability, coach?.responseTime, groupPrice, privatePrice, semiPrivatePrice, studentsDisplay]);

  const specialties = Array.isArray(coach?.specialties) ? coach.specialties.filter(Boolean) : [];
  const certifications = Array.isArray(coach?.certifications) ? coach.certifications.filter(Boolean) : [];

  const lessonsByCategory = useMemo(
    () => groupLessonTypes(coach?.lessonTypes ?? []),
    [coach?.lessonTypes],
  );

  const availableLessonCategories = useMemo(() => {
    return ["private", "group", "other"].filter((category) => lessonsByCategory[category].length > 0);
  }, [lessonsByCategory]);

  const [selectedCategory, setSelectedCategory] = useState(() => availableLessonCategories[0] ?? "private");

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
    () => lessonsByCategory[selectedCategory] ?? [],
    [lessonsByCategory, selectedCategory],
  );

  const [selectedLessonId, setSelectedLessonId] = useState(() => selectedLessons[0]?.id ?? "");

  useEffect(() => {
    if (!selectedLessons.length) {
      setSelectedLessonId("");
      return;
    }
    if (!selectedLessons.some((lesson) => lesson.id === selectedLessonId)) {
      setSelectedLessonId(selectedLessons[0].id);
    }
  }, [selectedLessons, selectedLessonId]);

  const availabilityEntries = useMemo(
    () => (Array.isArray(coach?.availabilityCalendar) ? coach.availabilityCalendar : []),
    [coach?.availabilityCalendar],
  );

  const availabilityMap = useMemo(() => {
    const map = new Map();
    availabilityEntries.forEach((entry) => {
      if (!entry || typeof entry !== "object" || !entry.date) return;
      const slots = Array.isArray(entry.slots) ? entry.slots.filter(Boolean) : [];
      map.set(entry.date, { date: entry.date, slots });
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

  const fallbackDateKey = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate(),
    ).padStart(2, "0")}`;
  }, []);

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
  const todayIso = useMemo(() => fallbackDateKey, [fallbackDateKey]);

  const [selectedDate, setSelectedDate] = useState(() => availableDates[0] ?? "");

  useEffect(() => {
    if (!availableDates.length) {
      setSelectedDate("");
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
        <Link className="coach-profile-backlink" to="/coaches">
          <ArrowLeft size={16} aria-hidden /> Back to Coaches
        </Link>
      </div>

      {loading ? (
        <div className="coach-profile-loading" role="status" aria-live="polite">
          <Loader2 className="coach-profile-spinner" size={28} aria-hidden />
          <span>Loading coach profile…</span>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="coach-profile-error" role="alert">
          <h1>We hit a snag</h1>
          <p>{error}</p>
          <Link className="coach-profile-error-link" to="/coaches">
            Browse other coaches
          </Link>
        </div>
      ) : null}

      {!loading && coach ? (
        <div className="coach-profile-content">
          <section className="coach-profile-card coach-profile-hero-card">
            <div className="coach-profile-hero">
              <div className="coach-profile-hero-top">
                <div className="coach-profile-avatar" aria-hidden={coach.avatar ? undefined : true}>
                  {coach.avatar ? (
                    <img src={coach.avatar} alt={coach.name} loading="lazy" />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div className="coach-profile-hero-body">
                  <div className="coach-profile-name-group">
                    <h1>{coach.name}</h1>
                    {coach.badge ? <span className="coach-profile-badge">{coach.badge}</span> : null}
                  </div>
                  {coach.bio ? <p className="coach-profile-bio">{coach.bio}</p> : null}
                  {summaryChips.length ? (
                    <ul className="coach-profile-meta-chips">
                      {summaryChips.map((chip) => {
                        const Icon = chip.icon;
                        return (
                          <li key={chip.id}>
                            <Icon size={14} aria-hidden />
                            <span>{chip.label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  {certifications.length ? (
                    <div className="coach-profile-certifications" role="list">
                      {certifications.map((cert) => (
                        <span className="coach-profile-certification" role="listitem" key={cert}>
                          {cert}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              {statCards.length ? (
                <div className="coach-profile-stat-grid">
                  {statCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <div className="coach-profile-stat-card" key={card.id}>
                        <div className="coach-profile-stat-icon">
                          <Icon size={18} aria-hidden />
                        </div>
                        <div>
                          <span className="coach-profile-stat-value">{card.label}</span>
                          {card.helper ? (
                            <span className="coach-profile-stat-label">{card.helper}</span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </section>

          <div className="coach-profile-body">
            <div className="coach-profile-main-column">
              <section className="coach-profile-card coach-profile-section">
                <header>
                  <h2>Specialties</h2>
                </header>
                {specialties.length ? (
                  <div className="coach-profile-chip-list" role="list">
                    {specialties.map((specialty) => (
                      <span className="coach-profile-chip" role="listitem" key={specialty}>
                        {specialty}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="coach-profile-empty">Specialties will appear here once the coach adds them.</p>
                )}
              </section>

              <section className="coach-profile-card coach-profile-section">
                <header>
                  <h2>Coaching Locations</h2>
                </header>
                {locationEntries.length ? (
                  <ul className="coach-profile-location-list">
                    {locationEntries.map((entry) => (
                      <li key={entry.id}>
                        <MapPin size={16} aria-hidden />
                        <span>{entry.label}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="coach-profile-empty">Coaching locations will appear here when shared.</p>
                )}
              </section>

              <section className="coach-profile-card coach-profile-section">
                <header>
                  <h2>Lesson Types</h2>
                </header>
                {availableLessonCategories.length ? (
                  <div className="coach-profile-lesson-grid">
                    {availableLessonCategories.map((category) => {
                      const lessons = lessonsByCategory[category];
                      const meta = lessonCategoryMetadata[category];
                      if (!lessons?.length) return null;
                      return (
                        <div className="coach-profile-lesson-card" key={category}>
                          <h3>{meta.title}</h3>
                          <p>{meta.description}</p>
                          <ul>
                            {lessons.map((lesson) => (
                              <li key={lesson.id}>
                                <span className="coach-profile-lesson-name">{lesson.label}</span>
                                {lesson.description ? (
                                  <span className="coach-profile-lesson-detail">{lesson.description}</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="coach-profile-empty">Lesson offerings will appear here once the coach adds them.</p>
                )}
              </section>

              {coach.typicalAvailability ? (
                <section className="coach-profile-card coach-profile-availability">
                  <div className="coach-profile-availability-icon">
                    <Calendar size={18} aria-hidden />
                  </div>
                  <div>
                    <h2>Typical availability</h2>
                    <p>{coach.typicalAvailability}</p>
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="coach-profile-aside">
              <section className="coach-profile-card coach-profile-booking-card">
                <header className="coach-profile-booking-header">
                  <div>
                    <h2>Book a Lesson</h2>
                    <p>Select a lesson type to see upcoming availability.</p>
                  </div>
                </header>

                <div className="coach-profile-booking-section">
                  <h3>Lesson type</h3>
                  {availableLessonCategories.length ? (
                    <div className="coach-profile-lesson-toggle" role="tablist">
                      {availableLessonCategories.map((category) => {
                        const isActive = selectedCategory === category;
                        const meta = lessonCategoryMetadata[category];
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
                    <p className="coach-profile-empty">Lesson offerings will appear here once the coach adds them.</p>
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
                            <span className="coach-profile-lesson-option-description">{lesson.description}</span>
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
                    {"SMTWTFS".split("").map((day) => (
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
                        slotCount ? ` – ${slotCount} time${slotCount > 1 ? "s" : ""} available` : ""
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
                          {isAvailable ? <span className="coach-profile-calendar-dot" aria-hidden /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="coach-profile-calendar-footer">
                  <h3>Available times</h3>
                  {selectedDate ? (
                    <p className="coach-profile-calendar-selected-date">{formatDateDisplay(selectedDate)}</p>
                  ) : null}
                  {hasAvailability ? (
                    selectedDate && selectedAvailability?.slots?.length ? (
                      <ul className="coach-profile-slot-list">
                        {selectedAvailability.slots.map((slot, index) => (
                          <li key={`${slot.start ?? slot.label ?? index}`}>{formatSlotLabel(slot, selectedDate)}</li>
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
