import { Check, MapPin, RefreshCcw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getPlayerCoaches, type PlayerCoach } from "../api/playerCalendar";
import MainLayout from "../components/MainLayout";
import StateBanner from "../components/coaches/StateBanner";
import useDebouncedValue from "../hooks/useDebouncedValue";
import useCoachNextAvailability, {
  type CoachAvailabilityState,
} from "../hooks/useCoachNextAvailability";

import "./MyCoachesPage.css";

type CoachStatusBadgeProps = {
  status?: string | number;
};

const CoachStatusBadge = ({ status }: CoachStatusBadgeProps) => {
  if (status === null || status === undefined || status === "") return null;
  const text = String(status);
  const isConfirmed = text.toLowerCase() === "confirmed";
  return (
    <span className={`my-coaches__badge${isConfirmed ? " my-coaches__badge--confirmed" : ""}`}>
      {isConfirmed && <Check size={11} strokeWidth={3} />}
      {text}
    </span>
  );
};

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
  // No real image — the card renders an initials tile instead.
  return null;
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #86EFAC, #22C55E)",
  "linear-gradient(135deg, #93C5FD, #3B82F6)",
  "linear-gradient(135deg, #C4B5FD, #8B5CF6)",
  "linear-gradient(135deg, #FDBA74, #F97316)",
  "linear-gradient(135deg, #F9A8D4, #EC4899)",
  "linear-gradient(135deg, #67E8F9, #06B6D4)",
];

const getAvatarGradient = (seed: string | number) => {
  const str = String(seed);
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
};

// Show a location only when it's a real place name — never a bare zip code
// (there is no zip -> neighborhood mapping available).
const isDisplayableLocation = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^(zip\s*)?\d{5}(-\d{4})?$/i.test(trimmed)) return false;
  return true;
};

const resolveLocation = (coach: PlayerCoach) => {
  const record = coach as Record<string, unknown>;
  const primary =
    record.location ??
    record.location_name ??
    record.city ??
    record.state ??
    record.country ??
    record.address ??
    "";

  if (primary) return primary;

  const coachLocations = record.coach_locations;
  if (Array.isArray(coachLocations) && coachLocations.length > 0) {
    const first = coachLocations[0];
    if (typeof first === "string" && first.trim()) return first;
    if (first !== null && first !== undefined) return String(first);
  }

  return "";
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
  return `$${numeric.toFixed(0)}`;
};

const AvailabilityBlock = ({ state }: { state: CoachAvailabilityState }) => {
  if (state.loading) {
    return <div className="my-coaches__avail my-coaches__avail--loading" aria-hidden />;
  }

  if (!state.slot) {
    return (
      <div className="my-coaches__avail my-coaches__avail--none">
        <span className="my-coaches__avail-dot" />
        <div className="my-coaches__avail-text">
          <div className="my-coaches__avail-label">Availability</div>
          <div className="my-coaches__avail-slot">No open times in the next 7 days</div>
        </div>
      </div>
    );
  }

  const { slot } = state;
  return (
    <div className={`my-coaches__avail my-coaches__avail--${slot.bucket}`}>
      <span className="my-coaches__avail-dot" />
      <div className="my-coaches__avail-text">
        <div className="my-coaches__avail-label">Next available</div>
        <div className="my-coaches__avail-slot">
          {slot.whenLabel} · {slot.timeLabel}
        </div>
      </div>
    </div>
  );
};

const MyCoachCard = ({ coach }: { coach: PlayerCoach }) => {
  const coachId = pickCoachId(coach);
  const name = resolveName(coach);
  const avatar = resolveAvatar(coach);
  const status = resolveStatus(coach);
  const locationRaw = resolveLocation(coach);
  const location = isDisplayableLocation(locationRaw) ? locationRaw : "";
  const hourlyRate = resolveHourlyRate(coach);

  const availability = useCoachNextAvailability(coachId as string | number | null | undefined);
  const noSlot = !availability.loading && !availability.slot;

  return (
    <article className="my-coaches__card">
      <div className="my-coaches__card-top">
        {avatar ? (
          <img className="my-coaches__photo" src={avatar} alt={`Portrait of ${name}`} />
        ) : (
          <div
            className="my-coaches__photo my-coaches__photo--initials"
            style={{ background: getAvatarGradient((coachId as string | number) ?? name) }}
            aria-hidden
          >
            {getInitials(name)}
          </div>
        )}

        <div className="my-coaches__info">
          <div className="my-coaches__name-row">
            <span className="my-coaches__name">{name}</span>
            {status && <CoachStatusBadge status={status} />}
          </div>
          {location && (
            <div className="my-coaches__loc">
              <MapPin size={12} />
              <span>{location}</span>
            </div>
          )}
        </div>

        {hourlyRate && (
          <div className="my-coaches__rate-inline">
            <span className="my-coaches__rate-amt">{hourlyRate}</span>
            <span className="my-coaches__rate-unit">/hour</span>
          </div>
        )}
      </div>

      <AvailabilityBlock state={availability} />

      {coachId && (
        <Link className="my-coaches__book" to={`/coaches/${coachId}`} state={{ focusBookCta: true }}>
          {noSlot ? "See full calendar" : "Book a lesson"}
        </Link>
      )}
    </article>
  );
};

const buildQueryParams = (search: string, location: string) => ({
  search: search.trim(),
  location: location.trim(),
});

const MyCoachesPage = () => {
  const [coaches, setCoaches] = useState<PlayerCoach[]>([]);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedLocation = useDebouncedValue(location, 300);

  const hasFilters = useMemo(
    () => Boolean(debouncedSearch.trim() || debouncedLocation.trim()),
    [debouncedLocation, debouncedSearch],
  );

  const fetchCoaches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPlayerCoaches({
        perPage: 25,
        page: 1,
        ...buildQueryParams(debouncedSearch, debouncedLocation),
      });
      setCoaches(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load coaches";
      setError(message);
      setCoaches([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedLocation, debouncedSearch]);

  useEffect(() => {
    fetchCoaches();
  }, [fetchCoaches]);

  const showEmpty = !loading && !error && coaches.length === 0;

  return (
    <MainLayout>
      <div className="my-coaches">
        <header className="my-coaches__header">
          <div>
            <p className="my-coaches__eyebrow">Roster</p>
            <h1 className="my-coaches__title">My coaches</h1>
            <p className="my-coaches__subtitle">
              Keep track of the coaches you are working with and jump to their profiles quickly.
            </p>
          </div>
          <button
            type="button"
            className="my-coaches__icon-button"
            onClick={fetchCoaches}
            aria-label="Refresh coaches"
          >
            <RefreshCcw size={18} />
          </button>
        </header>

        <div className="my-coaches__filters">
          <div className="my-coaches__input">
            <Search size={16} />
            <input
              type="search"
              placeholder="Search by name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="my-coaches__input">
            <MapPin size={16} />
            <input
              type="search"
              placeholder="Filter by location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </div>
        </div>

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
            title={hasFilters ? "No matches yet" : "No coaches in your roster"}
            message={
              hasFilters
                ? "Try a different search or clear your filters."
                : "Once you start working with coaches, they’ll appear here."
            }
          />
        )}

        {!loading && !error && coaches.length > 0 && (
          <div className="my-coaches__grid">
            {coaches.map((coach) => (
              <MyCoachCard key={pickCoachId(coach) ?? resolveName(coach)} coach={coach} />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default MyCoachesPage;
