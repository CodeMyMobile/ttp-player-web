import moment from "moment";
import { useEffect, useMemo, useState } from "react";
import { Clock, MapPin, Users, Zap, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getPlayerFutureLessons } from "../api/playerHome";
import MainLayout from "../components/MainLayout";
import usePlayerIdentity from "../hooks/usePlayerIdentity";
import { getStoredAuthToken } from "../services/authToken";

const pickString = (...values) => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return null;
};

const parseDate = (value) => {
  if (!value) return null;
  const date = moment(value);
  if (!date.isValid()) {
    return null;
  }
  return date.toDate();
};

const formatDurationLabel = (startAt, endAt) => {
  if (!startAt || !endAt) return null;
  const minutes = Math.round((endAt.getTime() - startAt.getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours && remainingMinutes) {
    return `${hours} hr ${remainingMinutes} min`;
  }
  if (hours) {
    return `${hours} hr${hours > 1 ? "s" : ""}`;
  }
  return `${minutes} min`;
};

const parseNumber = (...values) => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
};

const formatStatusLabel = (value) => {
  if (!value) return null;
  return value
    .toString()
    .replace(/[_]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const extractLessons = (response) => {
  if (!response) return [];
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.results)) return response.results;
  if (Array.isArray(response.items)) return response.items;
  return [];
};

const resolveLessonKind = (lesson) => {
  const limit = parseNumber(lesson.player_limit, lesson.playerLimit, lesson.max_players, lesson.player_capacity);
  const typeValue = pickString(lesson.lesson_type_name, lesson.type, lesson.lesson_type, lesson.program_type) || "";
  if (limit && limit > 1) return "group";
  if (/\b(group|semi|clinic|camp)\b/i.test(typeValue)) return "group";
  return "lesson";
};

const buildScheduleItems = (lessons = [], type) =>
  lessons
    .map((lesson) => {
      const startAt = parseDate(
        lesson.startTime ??
          lesson.start_time ??
          lesson.start_at ??
          lesson.start ??
          lesson.startDate ??
          lesson.starts_at ??
          lesson.start_date_time,
      );
      const endAt = parseDate(
        lesson.endTime ??
          lesson.end_time ??
          lesson.end_at ??
          lesson.end ??
          lesson.endDate ??
          lesson.ends_at ??
          lesson.end_date_time,
      );

      const idSource =
        lesson.id ??
        lesson.lesson_id ??
        lesson.lessonId ??
        lesson.booking_id ??
        lesson.uuid ??
        lesson.slug ??
        (startAt ? `${type}-${startAt.toISOString()}` : null);
      const id = `${type}-${idSource ?? Math.random().toString(36).slice(2)}`;

      const coach = lesson.coach ?? lesson.instructor ?? lesson.pro ?? {};
      const coachFullName = [coach.firstName ?? coach.first_name, coach.lastName ?? coach.last_name]
        .filter((part) => typeof part === "string" && part.trim())
        .join(" ");
      const coachName =
        pickString(
          lesson.coach_name,
          lesson.coachName,
          lesson.instructor_name,
          coachFullName,
          coach.name,
          coach.full_name,
          coach.fullName,
        ) || null;
      const coachLabel =
        coachName && /^coach\s+/i.test(coachName)
          ? coachName
          : coachName
            ? `Coach ${coachName}`
            : null;

      const locationLabel =
        pickString(
          lesson.location_name,
          lesson.locationName,
          lesson.location,
          lesson.location_label,
          lesson.locationLabel,
          lesson.court_name,
          lesson.court,
          lesson.facility_name,
          lesson.facility,
          lesson.address,
          lesson.venue_name,
          lesson.venueName,
        ) ||
        pickString(
          lesson?.location?.name,
          lesson?.location?.title,
          lesson?.location?.label,
          lesson?.venue?.name,
          lesson?.venue?.title,
          lesson?.coach_location?.name,
        );

      const rawStatus =
        pickString(lesson.status, lesson.registration_status, lesson.booking_status, lesson.lesson_status) ||
        null;
      const statusLabel = rawStatus ? formatStatusLabel(rawStatus) : null;

      const title =
        pickString(
          lesson.title,
          lesson.lesson_title,
          lesson.name,
          lesson.lesson_name,
          lesson.program_name,
          lesson.series_name,
          lesson.description,
        ) || (type === "group" ? "Group Session" : "Private Lesson");

      const badgeLabel =
        type === "group"
          ? "Group Session"
          : pickString(
              lesson.program_type,
              lesson.programName,
              lesson.program_label,
              lesson.category,
              lesson.type,
            );

      const durationLabel = formatDurationLabel(startAt, endAt);
      const dayLabel = startAt ? moment(startAt).format("ddd, MMM D") : null;
      const timeRangeLabel =
        startAt && endAt
          ? `${moment(startAt).format("h:mm A")} – ${moment(endAt).format("h:mm A")}`
          : startAt
            ? moment(startAt).format("h:mm A")
            : null;

      return {
        id,
        title,
        coachLabel,
        locationLabel: locationLabel ?? "Location TBD",
        statusLabel,
        badgeLabel,
        startAt,
        endAt,
        timeLabel: dayLabel ?? "Date TBD",
        secondaryLabel: timeRangeLabel ?? "Time TBD",
        durationLabel,
        type,
      };
    })
    .filter(Boolean);

const activityTypeMeta = {
  private: { label: "Private Lesson", emoji: "👤", action: "View Lesson" },
  group: { label: "Group Session", emoji: "👥", action: "View Lesson" },
};

const formatPriceLabel = (lesson) => {
  const amount = parseNumber(
    lesson.price_per_person,
    lesson.group_price_per_person,
    lesson.price,
    lesson.amount,
    lesson.lesson_price,
  );
  return amount !== null ? `$${amount.toFixed(2)}` : null;
};

const buildActivityItems = (lessons = []) =>
  lessons
    .map((lesson) => {
      const startAt = parseDate(
        lesson.startTime ??
          lesson.start_time ??
          lesson.start_at ??
          lesson.start ??
          lesson.startDate ??
          lesson.starts_at ??
          lesson.start_date_time,
      );
      const endAt = parseDate(
        lesson.endTime ??
          lesson.end_time ??
          lesson.end_at ??
          lesson.end ??
          lesson.endDate ??
          lesson.ends_at ??
          lesson.end_date_time,
      );
      if (!startAt) return null;

      const lessonId =
        lesson.id ??
        lesson.lesson_id ??
        lesson.lessonId ??
        lesson.booking_id ??
        lesson.uuid ??
        lesson.slug;
      const lessonKind = resolveLessonKind(lesson);
      const type = lessonKind === "group" ? "group" : "private";
      const durationLabel = formatDurationLabel(startAt, endAt);
      const durationMinutes =
        durationLabel && endAt
          ? Math.max(Math.round((endAt.getTime() - startAt.getTime()) / 60000), 0)
          : null;
      const level =
        pickString(
          lesson?.metadata?.level,
          lesson.metadata_level,
          lesson.lesson_type_name,
          lesson.program_type,
          lesson.level,
        ) || "All levels";
      const totalSpots = parseNumber(lesson.player_limit, lesson.playerLimit, lesson.max_players);
      const currentSpots = parseNumber(lesson.current_player_count, lesson.currentPlayerCount, lesson.players_joined) ?? 0;
      const spotsRemaining =
        type === "group" && totalSpots !== null ? Math.max(Math.round(totalSpots - currentSpots), 0) : null;
      const rawStatus = pickString(lesson.status, lesson.booking_status, lesson.payment_status, lesson.lesson_status);

      return {
        id: `activity-${type}-${lessonId ?? startAt.toISOString()}`,
        lessonId: lessonId != null ? String(lessonId) : null,
        type,
        title:
          pickString(
            lesson?.metadata?.title,
            lesson.title,
            lesson.lesson_title,
            lesson.name,
            lesson.lesson_name,
            lesson.program_name,
          ) || (type === "group" ? "Group Session" : "Private Lesson"),
        venue:
          pickString(
            lesson.location_name,
            lesson.locationName,
            lesson.location,
            lesson.location_label,
            lesson.court_name,
            lesson.facility_name,
          ) || "Location TBD",
        distance: null,
        level,
        durationMinutes,
        spotsRemaining,
        price: formatPriceLabel(lesson),
        badge: rawStatus ? formatStatusLabel(rawStatus) : null,
        startTime: startAt.toISOString(),
      };
    })
    .filter(Boolean)
    .sort((first, second) => moment(first.startTime).valueOf() - moment(second.startTime).valueOf());

const quickBookCoaches = [
  {
    id: "quick-book-1",
    name: "Mia Roberts",
    rating: "4.9",
    specialty: "Serve & Return",
    nextAvailable: "Today · 6:00 PM",
    price: "$95",
  },
  {
    id: "quick-book-2",
    name: "David Park",
    rating: "4.8",
    specialty: "High Performance",
    nextAvailable: "Today · 7:30 PM",
    price: "$105",
  },
  {
    id: "quick-book-3",
    name: "Jamie Lee",
    rating: "4.9",
    specialty: "Junior Development",
    nextAvailable: "Tomorrow · 8:00 AM",
    price: "$90",
  },
  {
    id: "quick-book-4",
    name: "Carlos Ramirez",
    rating: "4.7",
    specialty: "Serve Specialist",
    nextAvailable: "Tomorrow · 4:45 PM",
    price: "$88",
  },
  {
    id: "quick-book-5",
    name: "Ava Patel",
    rating: "5.0",
    specialty: "Doubles Strategy",
    nextAvailable: "Friday · 5:15 PM",
    price: "$120",
  },
];

const formatRelativeStartLabel = (startTime) => {
  const startMoment = moment(startTime);
  if (!startMoment.isValid()) {
    return "Starting soon";
  }
  const now = moment();
  const diffMinutes = Math.max(0, startMoment.diff(now, "minutes"));

  if (diffMinutes === 0) {
    return "Starting now";
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  if (hours && minutes) {
    return `${hours}h ${minutes}m`;
  }

  if (hours) {
    return `${hours}h`;
  }

  return `${minutes}m`;
};

const ActivityCard = ({ activity, onAction }) => {
  const meta = activityTypeMeta[activity.type];
  const startMoment = moment(activity.startTime);
  if (!meta || !startMoment.isValid()) {
    return null;
  }
  const today = moment();
  const isToday = startMoment.isSame(today, "day");
  const isTomorrow = startMoment.isSame(today.clone().add(1, "day"), "day");
  const dayLabel = isToday ? "Today" : isTomorrow ? "Tomorrow" : startMoment.format("ddd");
  const relativeLabel = formatRelativeStartLabel(activity.startTime);
  const spotsLabel =
    typeof activity.spotsRemaining === "number"
      ? `${activity.spotsRemaining} spot${activity.spotsRemaining === 1 ? "" : "s"} left`
      : null;

  return (
    <article className={`activity-card activity-card--${activity.type}`}>
      <header className="activity-card__header">
        <div className="activity-card__type">
          <span className="activity-card__type-icon" aria-hidden="true">
            {meta.emoji}
          </span>
          <span>{meta.label}</span>
        </div>
        {activity.badge ? <span className="activity-card__badge">{activity.badge}</span> : null}
      </header>
      <h3 className="activity-card__title">{activity.title}</h3>
      <div className="activity-card__info">
        <div className="activity-card__info-row">
          <Clock size={16} strokeWidth={2} />
          <span>
            {dayLabel} · {startMoment.format("h:mm A")}
          </span>
          <span className="activity-card__dot" aria-hidden="true">
            •
          </span>
          <span>{relativeLabel}</span>
        </div>
        <div className="activity-card__info-row">
          <MapPin size={16} strokeWidth={2} />
          <span>{activity.venue}</span>
          {activity.distance ? (
            <>
              <span className="activity-card__dot" aria-hidden="true">
                •
              </span>
              <span>{activity.distance}</span>
            </>
          ) : null}
        </div>
        <div className="activity-card__info-row">
          <Users size={16} strokeWidth={2} />
          <span>{activity.level}</span>
          {activity.durationMinutes ? (
            <>
              <span className="activity-card__dot" aria-hidden="true">
                •
              </span>
              <span>{`${activity.durationMinutes} min`}</span>
            </>
          ) : null}
        </div>
      </div>
      <footer className="activity-card__footer">
        <div className="activity-card__footer-details">
          {spotsLabel ? <span className="activity-card__spots">{spotsLabel}</span> : null}
          {activity.price ? <span className="activity-card__price">{activity.price}</span> : null}
        </div>
        <button type="button" className="activity-card__action" onClick={() => onAction(activity)}>
          {meta.action}
        </button>
      </footer>
    </article>
  );
};

const QuickBookButton = ({ onClick, isOpen }) => (
  <button
    type="button"
    className={`quick-book-button${isOpen ? " is-active" : ""}`}
    onClick={onClick}
    aria-label="Quick Book"
  >
    <Zap size={22} strokeWidth={2} />
    <span>Quick Book</span>
  </button>
);

const QuickBookModal = ({ coaches, onClose }) => (
  <div className="quick-book-overlay" role="dialog" aria-modal="true" aria-labelledby="quick-book-title">
    <div className="quick-book-overlay__backdrop" onClick={onClose} />
    <div className="quick-book-modal" role="document">
      <header className="quick-book-modal__header">
        <div>
          <h2 id="quick-book-title">Quick Book a Lesson</h2>
          <p className="quick-book-modal__subtitle">
            Book with one of our featured coaches right now
          </p>
        </div>
        <button type="button" className="quick-book-modal__close" onClick={onClose} aria-label="Close">
          <X size={18} strokeWidth={2} />
        </button>
      </header>
      <div className="quick-book-modal__body">
        {coaches.map((coach) => (
          <article key={coach.id} className="quick-book-coach">
            <div className="quick-book-coach__avatar" aria-hidden="true">
              {coach.name
                .split(" ")
                .map((part) => part.charAt(0))
                .join("")}
            </div>
            <div className="quick-book-coach__details">
              <div className="quick-book-coach__top-row">
                <span className="quick-book-coach__name">{coach.name}</span>
                <span className="quick-book-coach__rating">⭐ {coach.rating}</span>
              </div>
              <div className="quick-book-coach__specialty">{coach.specialty}</div>
              <div className="quick-book-coach__availability">Next available · <span>{coach.nextAvailable}</span></div>
            </div>
            <div className="quick-book-coach__cta">
              <div className="quick-book-coach__price">{coach.price}</div>
              <button type="button" className="quick-book-coach__button">
                Book Now
              </button>
            </div>
          </article>
        ))}
      </div>
      <footer className="quick-book-modal__footer">
        <button type="button" className="quick-book-modal__link">
          View All Coaches →
        </button>
      </footer>
    </div>
  </div>
);

const matches = [
  {
    type: "Doubles",
    title: "Friendly Ladder",
    details: ["Tomorrow • 6:30 PM", "Court 4 • 2 spots left"],
  },
  {
    type: "Singles",
    title: "Skill Challenge",
    details: ["Thursday • 5:00 PM", "Court 1 • Intermediate"],
  },
  {
    type: "Cardio",
    title: "Endurance Clinic",
    details: ["Saturday • 9:00 AM", "Fitness Center • 6 spots"],
  },
];

const coaches = [
  { name: "Mia Roberts", speciality: "USTA Certified", rating: "4.9", sessions: "32 lessons" },
  { name: "David Park", speciality: "High Performance", rating: "4.8", sessions: "28 lessons" },
  { name: "Jamie Lee", speciality: "Junior Development", rating: "4.9", sessions: "19 lessons" },
  { name: "Carlos Ramirez", speciality: "Serve Specialist", rating: "4.7", sessions: "24 lessons" },
];

const bottomActions = [
  {
    title: "AI Match Me",
    description: "Get matched instantly with players at your level.",
    action: "Start",
    accent: "#16a34a",
  },
  {
    title: "Get Gear",
    description: "Shop curated gear recommended by pros.",
    action: "Shop",
    accent: "#f97316",
  },
];

const DashboardPage = () => {
  const navigate = useNavigate();
  const { displayName } = usePlayerIdentity();
  const [locationState, setLocationState] = useState({
    status: "idle",
    coords: null,
    error: null,
    accuracyMiles: null,
    locationName: null,
    lookupFailed: false,
  });
  const [distanceFilter, setDistanceFilter] = useState("10");
  const [scheduleState, setScheduleState] = useState({
    status: "idle",
    items: [],
    error: null,
  });
  const [activityState, setActivityState] = useState({
    status: "idle",
    items: [],
    error: null,
  });
  const [dateFilter, setDateFilter] = useState({ type: "all" });
  const [isCustomRangeOpen, setIsCustomRangeOpen] = useState(false);
  const [customRangeStart, setCustomRangeStart] = useState("");
  const [customRangeEnd, setCustomRangeEnd] = useState("");
  const [customRangeError, setCustomRangeError] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [showQuickBook, setShowQuickBook] = useState(false);

  const distanceOptions = ["5", "10", "15", "20", "all"];
  const activities = activityState.items;
  const todayAnchor = useMemo(() => moment().startOf("day"), []);
  const todayIso = useMemo(() => todayAnchor.format("YYYY-MM-DD"), [todayAnchor]);
  const maxSelectableDate = useMemo(
    () => todayAnchor.clone().add(30, "days").format("YYYY-MM-DD"),
    [todayAnchor],
  );

  const dayOptions = useMemo(() => {
    const countsByDay = activities.reduce((accumulator, activity) => {
      const key = moment(activity.startTime).startOf("day").format("YYYY-MM-DD");
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});

    return Array.from({ length: 14 }).map((_, index) => {
      const dayMoment = todayAnchor.clone().add(index, "days");
      const key = dayMoment.format("YYYY-MM-DD");
      const isToday = index === 0;
      const isTomorrow = index === 1;

      return {
        value: key,
        label: isToday ? "Today" : isTomorrow ? "Tomorrow" : dayMoment.format("ddd"),
        date: dayMoment.format("D"),
        events: countsByDay[key] || 0,
        fullLabel: `${dayMoment.format("ddd, MMM D")}`,
      };
    });
  }, [activities, todayAnchor]);

  const scopedActivities = useMemo(() => {
    return activities.filter((activity) => {
      if (dateFilter.type === "all") {
        return true;
      }

      const activityDay = moment(activity.startTime).startOf("day");

      if (dateFilter.type === "day") {
        return activityDay.format("YYYY-MM-DD") === dateFilter.iso;
      }

      const rangeStart = moment(dateFilter.start).startOf("day");
      const rangeEnd = moment(dateFilter.end).endOf("day");
      return activityDay.isBetween(rangeStart, rangeEnd, undefined, "[]");
    });
  }, [activities, dateFilter]);

  const typeCounts = useMemo(() => {
    const base = scopedActivities;
    return {
      all: base.length,
      private: base.filter((activity) => activity.type === "private").length,
      group: base.filter((activity) => activity.type === "group").length,
    };
  }, [scopedActivities]);

  const typeFilterOptions = [
    { id: "all", label: "All Activities" },
    { id: "private", label: "Private Lessons" },
    { id: "group", label: "Group Sessions" },
  ];

  const filteredActivities = useMemo(() => {
    return scopedActivities
      .filter((activity) => activeFilter === "all" || activity.type === activeFilter)
      .sort((first, second) =>
        moment(first.startTime).valueOf() - moment(second.startTime).valueOf(),
      );
  }, [activeFilter, scopedActivities]);

  useEffect(() => {
    setShowAllActivities(false);
  }, [activeFilter, dateFilter]);

  const displayedActivities = showAllActivities
    ? filteredActivities
    : filteredActivities.slice(0, 3);
  const remainingActivityCount = filteredActivities.length - displayedActivities.length;

  const selectedDayMeta =
    dateFilter.type === "day"
      ? dayOptions.find((option) => option.value === dateFilter.iso) ?? null
      : null;

  const dateFilterChipLabel = (() => {
    if (dateFilter.type === "all") {
      return "All Days";
    }
    if (dateFilter.type === "day") {
      return selectedDayMeta?.fullLabel ?? "Selected Day";
    }
    const startLabel = moment(dateFilter.start).format("ddd, MMM D");
    const endLabel = moment(dateFilter.end).format("ddd, MMM D");
    return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
  })();

  const customRangeButtonLabel = (() => {
    if (dateFilter.type !== "range") {
      return "Choose dates";
    }
    const startLabel = moment(dateFilter.start).format("MMM D");
    const endLabel = moment(dateFilter.end).format("MMM D");
    const summary = startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
    return `Custom: ${summary}`;
  })();

  const emptyStateMessage = (() => {
    if (dateFilter.type === "all") {
      return "Try adjusting your filters to discover more sessions.";
    }
    if (dateFilter.type === "day") {
      const label = selectedDayMeta?.fullLabel ?? "this day";
      return `Nothing is scheduled for ${label} with these filters. Try expanding your search.`;
    }
    const startFull = moment(dateFilter.start).format("ddd, MMM D");
    const endFull = moment(dateFilter.end).format("ddd, MMM D");
    if (dateFilter.start === dateFilter.end) {
      return `Nothing is scheduled for ${startFull} with these filters. Try expanding your search.`;
    }
    return `Nothing is scheduled from ${startFull} to ${endFull} with these filters. Try expanding your search.`;
  })();

  const activeFilterLabel =
    activeFilter === "all"
      ? "All Activities"
      : activityTypeMeta[activeFilter]?.label ?? "All Activities";

  const hasActiveFilters = dateFilter.type !== "all" || activeFilter !== "all";

  const clearFilters = () => {
    setDateFilter({ type: "all" });
    setActiveFilter("all");
    setIsCustomRangeOpen(false);
    setCustomRangeStart("");
    setCustomRangeEnd("");
    setCustomRangeError(null);
  };

  const handleToggleCustomRange = () => {
    setIsCustomRangeOpen((open) => {
      if (open) {
        setCustomRangeError(null);
        return false;
      }

      if (dateFilter.type === "range") {
        setCustomRangeStart(dateFilter.start);
        setCustomRangeEnd(dateFilter.end);
      } else if (dateFilter.type === "day") {
        setCustomRangeStart(dateFilter.iso);
        setCustomRangeEnd(dateFilter.iso);
      } else {
        setCustomRangeStart(todayIso);
        setCustomRangeEnd(todayIso);
      }

      setCustomRangeError(null);
      return true;
    });
  };

  const handleApplyCustomRange = () => {
    if (!customRangeStart || !customRangeEnd) {
      setCustomRangeError("Select both a start and end date.");
      return;
    }
    if (customRangeStart > customRangeEnd) {
      setCustomRangeError("Start date must be before the end date.");
      return;
    }
    setCustomRangeError(null);
    setDateFilter({ type: "range", start: customRangeStart, end: customRangeEnd });
    setIsCustomRangeOpen(false);
  };

  const handleClearCustomRange = () => {
    setCustomRangeStart("");
    setCustomRangeEnd("");
    setCustomRangeError(null);
    setDateFilter({ type: "all" });
    setIsCustomRangeOpen(false);
  };

  const formatDistanceLabel = (value) => (value === "all" ? "All" : `${value} mi`);

  const formatCoordinatesLabel = (coords) => {
    if (!coords) {
      return "Your area";
    }

    const latitude = Math.abs(coords.latitude).toFixed(2);
    const longitude = Math.abs(coords.longitude).toFixed(2);
    const latHemisphere = coords.latitude >= 0 ? "N" : "S";
    const lonHemisphere = coords.longitude >= 0 ? "E" : "W";

    return `${latitude}° ${latHemisphere}, ${longitude}° ${lonHemisphere}`;
  };

  const resolveLocationName = async (coords) => {
    if (!coords) {
      return;
    }

    try {
      const query = new URLSearchParams({
        format: "jsonv2",
        lat: coords.latitude.toString(),
        lon: coords.longitude.toString(),
      });

      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${query.toString()}`, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to lookup location");
      }

      const data = await response.json();
      const address = data?.address ?? {};

      const locality =
        address.city ||
        address.town ||
        address.village ||
        address.hamlet ||
        address.suburb ||
        address.county;
      const region = address.state || address.region;
      const countryCode = address.country_code ? address.country_code.toUpperCase() : null;

      const labelParts = [locality, region, countryCode].filter(Boolean);
      const locationLabel = labelParts.length
        ? labelParts.join(", ")
        : data?.display_name?.split(",").slice(0, 2).join(", ") || null;

      setLocationState((previous) => {
        if (previous.status !== "ready") {
          return previous;
        }

        return {
          ...previous,
          locationName: locationLabel,
          lookupFailed: !locationLabel,
        };
      });
    } catch (error) {
      console.error("Failed to resolve location", error);
      setLocationState((previous) => {
        if (previous.status !== "ready") {
          return previous;
        }

        return {
          ...previous,
          locationName: null,
          lookupFailed: true,
        };
      });
    }
  };

  const detectLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocationState({
        status: "error",
        coords: null,
        error: "Location services are not supported in this browser.",
        accuracyMiles: null,
        locationName: null,
        lookupFailed: false,
      });
      return;
    }

    setLocationState((previous) => ({
      ...previous,
      status: "loading",
      error: null,
      lookupFailed: false,
    }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { coords } = position;
        const accuracyMiles = coords.accuracy
          ? Math.max(1, Math.round(coords.accuracy / 1609.34))
          : null;

        setLocationState({
          status: "ready",
          coords,
          error: null,
          accuracyMiles,
          locationName: null,
          lookupFailed: false,
        });
        resolveLocationName(coords);
      },
      (error) => {
        setLocationState({
          status: "error",
          coords: null,
          error: error.message || "We couldn't determine your location.",
          accuracyMiles: null,
          locationName: null,
          lookupFailed: false,
        });
      }
    );
  };

  useEffect(() => {
    detectLocation();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadSchedule = async () => {
      const token = getStoredAuthToken({ preferScheme: "token" });
      if (!token) {
        setScheduleState({ status: "unauthenticated", items: [], error: null });
        setActivityState({ status: "unauthenticated", items: [], error: null });
        return;
      }

      setScheduleState((previous) => ({
        ...previous,
        status: "loading",
        error: null,
      }));
      setActivityState((previous) => ({
        ...previous,
        status: "loading",
        error: null,
      }));

      try {
        const lessonsResponse = await getPlayerFutureLessons({
          token,
          perPage: 25,
          signal: controller.signal,
        });

        if (cancelled) return;

        const upcomingLessons = extractLessons(lessonsResponse);
        const privateLessons = buildScheduleItems(
          upcomingLessons.filter((lesson) => resolveLessonKind(lesson) !== "group"),
          "lesson",
        );
        const groupLessons = buildScheduleItems(
          upcomingLessons.filter((lesson) => resolveLessonKind(lesson) === "group"),
          "group",
        );
        const combined = [...privateLessons, ...groupLessons].sort((a, b) => {
          if (a.startAt && b.startAt) {
            return a.startAt.getTime() - b.startAt.getTime();
          }
          if (a.startAt) return -1;
          if (b.startAt) return 1;
          return 0;
        });

        const annotated = combined.map((item, index) => ({
          ...item,
          highlight: index === 0 && !!item.startAt,
        }));

        setScheduleState({
          status: "ready",
          items: annotated,
          error: null,
        });
        setActivityState({
          status: "ready",
          items: buildActivityItems(upcomingLessons),
          error: null,
        });
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load upcoming lessons", error);
        setScheduleState({
          status: "error",
          items: [],
          error: error instanceof Error ? error.message : "Unable to load schedule.",
        });
        setActivityState({
          status: "error",
          items: [],
          error: error instanceof Error ? error.message : "Unable to load lessons.",
        });
      }
    };

    loadSchedule();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const locationChipLabel = () => {
    if (locationState.status === "ready") {
      if (locationState.locationName) {
        return locationState.locationName;
      }

      if (locationState.coords) {
        return formatCoordinatesLabel(locationState.coords);
      }

      return "Los Angeles, California, US";
    }

    if (locationState.status === "loading") {
      return "Locating…";
    }

    if (locationState.status === "error") {
      return "Location unavailable";
    }

    return "Los Angeles, California, US";
  };

  const handleViewActivity = (activity) => {
    if (!activity?.lessonId) {
      navigate("/player/calendar");
      return;
    }
    if (activity.type === "group") {
      navigate(`/group-lessons/${activity.lessonId}`);
      return;
    }
    navigate(`/player/lesson/${activity.lessonId}`);
  };

  return (
    <MainLayout>
      <section className="play-hero">
        <div className="play-hero__intro">
          <div className="play-hero__lead">
            <div className="play-hero__text">
              <p className="play-hero__eyebrow">Ready to Play?</p>
              <h1>Welcome back, {displayName}. Let&rsquo;s get you on court.</h1>
              <p className="play-hero__subtitle">
                Discover curated matches, lessons, and group sessions tailored to your level and
                schedule.
              </p>
            </div>
            <div
              className={`play-hero__location-surface play-hero__location-surface--${locationState.status}`}
            >
              <div className="play-hero__location-row">
                <div className="play-hero__location-group">
                  <button
                    type="button"
                    className={`play-hero__distance-chip play-hero__distance-chip--location play-hero__distance-chip--${locationState.status}`}
                    aria-label="Current location"
                    onClick={detectLocation}
                    disabled={locationState.status === "loading"}
                  >
                    <MapPin size={16} strokeWidth={2} />
                    <span>{locationChipLabel()}</span>
                  </button>
                  {distanceOptions.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`play-hero__distance-chip${distanceFilter === value ? " play-hero__distance-chip--active" : ""}`}
                      onClick={() => setDistanceFilter(value)}
                    >
                      {formatDistanceLabel(value)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="day-selector">
                <div className="day-selector__controls">
                  <div
                    className="day-selector__scroller"
                    role="group"
                    aria-label="Filter activities by day"
                  >
                    <button
                      type="button"
                      className={`day-selector__day${dateFilter.type === "all" ? " is-active" : ""}`}
                      onClick={() => {
                        setDateFilter({ type: "all" });
                        setIsCustomRangeOpen(false);
                        setCustomRangeStart("");
                        setCustomRangeEnd("");
                        setCustomRangeError(null);
                      }}
                    >
                      <span className="day-selector__label">All</span>
                      <span className="day-selector__events">{activities.length} events</span>
                    </button>
                    {dayOptions.map((day) => {
                      const classes = ["day-selector__day"];
                      if (dateFilter.type === "day" && dateFilter.iso === day.value) {
                        classes.push("is-active");
                      }
                      if (day.events === 0) {
                        classes.push("is-empty");
                      }
                      return (
                        <button
                          key={day.value}
                          type="button"
                          className={classes.join(" ")}
                          onClick={() => {
                            setDateFilter({ type: "day", iso: day.value });
                            setIsCustomRangeOpen(false);
                            setCustomRangeStart(day.value);
                            setCustomRangeEnd(day.value);
                            setCustomRangeError(null);
                          }}
                        >
                          <span className="day-selector__label">{day.label}</span>
                          <span className="day-selector__date">{day.date}</span>
                          <span className="day-selector__events">
                            {day.events} event{day.events === 1 ? "" : "s"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="day-selector__actions">
                    <button
                      type="button"
                      className={`day-selector__action${dateFilter.type === "range" ? " is-active" : ""}`}
                      aria-expanded={isCustomRangeOpen}
                      onClick={handleToggleCustomRange}
                    >
                      {customRangeButtonLabel}
                    </button>
                    <button
                      type="button"
                      className="day-selector__view-all"
                      onClick={() => navigate("/player/calendar")}
                    >
                      View All
                    </button>
                  </div>
                </div>
                {isCustomRangeOpen ? (
                  <div className="day-selector__range">
                    <div className="day-selector__range-fields">
                      <label className="day-selector__range-field">
                        <span>Start</span>
                        <input
                          type="date"
                          value={customRangeStart}
                          min={todayIso}
                          max={customRangeEnd || maxSelectableDate}
                          onChange={(event) => {
                            setCustomRangeStart(event.target.value);
                            setCustomRangeError(null);
                          }}
                        />
                      </label>
                      <label className="day-selector__range-field">
                        <span>End</span>
                        <input
                          type="date"
                          value={customRangeEnd}
                          min={customRangeStart || todayIso}
                          max={maxSelectableDate}
                          onChange={(event) => {
                            setCustomRangeEnd(event.target.value);
                            setCustomRangeError(null);
                          }}
                        />
                      </label>
                    </div>
                    <p className="day-selector__range-hint">
                      {customRangeStart && customRangeEnd
                        ? customRangeStart === customRangeEnd
                          ? `Showing activities for ${moment(customRangeStart).format("MMM D")}.`
                          : `Showing activities from ${moment(customRangeStart).format("MMM D")} to ${moment(customRangeEnd).format("MMM D")}.`
                        : "Select a start and end date to filter activities."}
                    </p>
                    {customRangeError ? (
                      <p className="day-selector__range-error">{customRangeError}</p>
                    ) : null}
                    <div className="day-selector__range-actions">
                      <button type="button" onClick={handleClearCustomRange}>
                        Clear
                      </button>
                      <button type="button" onClick={handleApplyCustomRange}>
                        Apply range
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="type-filter-bar">
                {typeFilterOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`type-filter-bar__chip${activeFilter === option.id ? " is-active" : ""}`}
                    onClick={() => setActiveFilter(option.id)}
                  >
                    <span>{option.label}</span>
                    <span className="type-filter-bar__count">{typeCounts[option.id] ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="play-hero__status">
            <div className="play-hero__status-card">
              <span className="play-hero__status-label">Next booking</span>
              <span className="play-hero__status-value">Today · 5:30 PM</span>
              <span className="play-hero__status-meta">Court 4 with Jamie</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section activity-section" id="activities">
        <div className="section-header activity-section__header">
          <div>
            <h2 className="section-title">My Activity</h2>
            <p className="section-subtitle">
              Your upcoming private and group lessons.
            </p>
          </div>
          <button
            type="button"
            className="section-cta activity-section__cta"
            onClick={() => navigate("/player/calendar")}
          >
            See All
          </button>
        </div>
        {hasActiveFilters ? (
          <div className="activity-active-filters">
            <span className="activity-active-filters__label">Showing:</span>
            <div className="activity-active-filters__chips">
              <span className="activity-active-filters__chip">{dateFilterChipLabel}</span>
              {activeFilter !== "all" ? (
                <span className="activity-active-filters__chip">{activeFilterLabel}</span>
              ) : null}
            </div>
            <button type="button" className="activity-active-filters__clear" onClick={clearFilters}>
              Clear all
            </button>
          </div>
        ) : null}
        {activityState.status === "loading" || activityState.status === "idle" ? (
          <div className="schedule-feedback">Loading your activities…</div>
        ) : activityState.status === "error" ? (
          <div className="schedule-feedback schedule-feedback--error">
            We couldn&rsquo;t load your activities. Please try again.
          </div>
        ) : activityState.status === "unauthenticated" ? (
          <div className="schedule-feedback">Sign in to view your activities.</div>
        ) : filteredActivities.length === 0 ? (
          <div className="activity-empty-state">
            <div className="activity-empty-state__icon" aria-hidden="true">
              🎾
            </div>
            <h3>No upcoming lessons</h3>
            <p>{emptyStateMessage}</p>
            <div className="activity-empty-state__actions">
              <button type="button" className="activity-empty-state__primary" onClick={clearFilters}>
                View All Activities
              </button>
              <button
                type="button"
                className="activity-empty-state__secondary"
                onClick={() => navigate("/player/calendar")}
              >
                Browse Calendar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="activity-feed">
              {displayedActivities.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} onAction={handleViewActivity} />
              ))}
            </div>
            {filteredActivities.length > 3 ? (
              <div className="activity-feed__more">
                <button
                  type="button"
                  className="activity-feed__more-button"
                  onClick={() => setShowAllActivities((previous) => !previous)}
                >
                  {showAllActivities
                    ? "Show Less"
                    : `Show More${remainingActivityCount > 0 ? ` (${remainingActivityCount})` : ""}`}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="section" id="schedule">
        <div className="section-header schedule-header">
          <div>
            <h2 className="section-title">My Schedule</h2>
            <p className="section-subtitle">Your upcoming matches and coaching sessions for the day.</p>
          </div>
        </div>
        {scheduleState.status === "loading" || scheduleState.status === "idle" ? (
          <div className="schedule-feedback">Loading your schedule…</div>
        ) : scheduleState.status === "error" ? (
          <div className="schedule-feedback schedule-feedback--error">
            We couldn&rsquo;t load your upcoming lessons. Please try again.
          </div>
        ) : scheduleState.status === "unauthenticated" ? (
          <div className="schedule-feedback">Sign in to view your upcoming lessons.</div>
        ) : scheduleState.items.length === 0 ? (
          <div className="schedule-feedback">
            You don&rsquo;t have any upcoming lessons yet. Book a session to get started!
          </div>
        ) : (
          <div className="schedule-condensed">
            {scheduleState.items.slice(0, 3).map((item) => (
              <article key={item.id} className="schedule-condensed__card">
                <div className="schedule-condensed__time">
                  <span>{item.timeLabel}</span>
                  <span>{item.secondaryLabel}</span>
                </div>
                <div className="schedule-condensed__details">
                  <div className="schedule-condensed__title">{item.title}</div>
                  {item.coachLabel ? <div className="schedule-condensed__meta">{item.coachLabel}</div> : null}
                  {item.locationLabel ? <div className="schedule-condensed__meta">{item.locationLabel}</div> : null}
                  {item.durationLabel ? (
                    <div className="schedule-condensed__meta">⏱ {item.durationLabel}</div>
                  ) : null}
                </div>
                <div className="schedule-condensed__aside">
                  {item.badgeLabel ? <div className="tag">{item.badgeLabel}</div> : null}
                  {item.statusLabel ? <div className="status-badge">{item.statusLabel}</div> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section" id="matches">
        <div className="section-header">
          <div>
            <h2 className="section-title">Matches Near You</h2>
            <p className="section-subtitle">Join competitive and social matches happening soon.</p>
          </div>
          <button
            type="button"
            className="section-cta"
            onClick={() => navigate("/matches/create")}
          >
            + Create Match
          </button>
        </div>
        <div className="matches-grid">
          {matches.map((match) => (
            <article key={match.title} className="match-card">
              <div className="match-type">{match.type}</div>
              <div className="match-title">{match.title}</div>
              <div className="match-meta">
                {match.details.map((detail) => (
                  <span key={detail}>{detail}</span>
                ))}
              </div>
              <button type="button" className="join-btn">
                Join Match
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="coaches">
        <div className="section-header">
          <div>
            <h2 className="section-title">Featured Coaches</h2>
            <p className="section-subtitle">Top coaches with stellar reviews from players like you.</p>
          </div>
          <button type="button" className="section-cta">
            View All Coaches
          </button>
        </div>
        <div className="coaches-grid">
          {coaches.map((coach) => (
            <article key={coach.name} className="coach-card">
              <div className="coach-avatar">{coach.name.split(" ").map((part) => part[0]).join("")}</div>
              <div className="coach-name">{coach.name}</div>
              <div className="coach-speciality">{coach.speciality}</div>
              <div className="coach-speciality">{coach.sessions}</div>
              <div className="rating">⭐ {coach.rating}</div>
              <button type="button" className="coach-btn">
                Book Session
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="bottom-actions" id="activity">
        {bottomActions.map((action) => (
          <article key={action.title} className="bottom-card" style={{ borderTop: `4px solid ${action.accent}` }}>
            <h3>{action.title}</h3>
            <p>{action.description}</p>
            <button type="button" style={{ background: action.accent }}>
              {action.action}
            </button>
          </article>
        ))}
      </section>
      <QuickBookButton onClick={() => setShowQuickBook(true)} isOpen={showQuickBook} />
      {showQuickBook ? (
        <QuickBookModal coaches={quickBookCoaches} onClose={() => setShowQuickBook(false)} />
      ) : null}
    </MainLayout>
  );
};

export default DashboardPage;
