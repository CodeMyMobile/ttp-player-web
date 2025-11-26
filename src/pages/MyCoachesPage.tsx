import { RefreshCcw, Search, Star, MapPin } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getPlayerCoaches, type PlayerCoach } from "../api/playerCalendar";
import MainLayout from "../components/MainLayout";
import StateBanner from "../components/coaches/StateBanner";
import useDebouncedValue from "../hooks/useDebouncedValue";

import "./MyCoachesPage.css";

type CoachStatusBadgeProps = {
  status?: string | number;
};

const CoachStatusBadge = ({ status }: CoachStatusBadgeProps) => {
  if (status === null || status === undefined || status === "") return null;
  return <span className="my-coaches__status">{String(status)}</span>;
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
  return "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=256&q=80";
};

const resolveRating = (coach: PlayerCoach) => {
  const record = coach as Record<string, unknown>;
  const value = record.rating ?? record.average_rating ?? record.avg_rating ?? record.score;
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric.toFixed(1) : null;
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

const resolveDistance = (coach: PlayerCoach) => {
  const record = coach as Record<string, unknown>;
  const value = record.distance ?? record.distance_miles ?? record.distanceMiles;
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? `${numeric.toFixed(1)} mi away` : "";
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

const resolveAbout = (coach: PlayerCoach) => {
  const record = coach as Record<string, unknown>;
  const about =
    record.about_me ?? record.about ?? record.bio ?? record.description ?? record.summary;
  if (typeof about !== "string") return "";
  return about.trim();
};

const resolveLocationTags = (coach: PlayerCoach) => {
  const record = coach as Record<string, unknown>;
  const rawLocations =
    record.coach_locations ?? record.locations ?? record.location_tags ?? record.service_locations;
  if (Array.isArray(rawLocations)) {
    return rawLocations
      .map((loc) => (typeof loc === "string" ? loc : String(loc ?? "")))
      .filter(Boolean)
      .slice(0, 3);
  }
  return [];
};

const MyCoachCard = ({ coach }: { coach: PlayerCoach }) => {
  const coachId = pickCoachId(coach);
  const name = resolveName(coach);
  const avatar = resolveAvatar(coach);
  const rating = resolveRating(coach);
  const location = resolveLocation(coach);
  const distance = resolveDistance(coach);
  const status = resolveStatus(coach);
  const hourlyRate = resolveHourlyRate(coach);
  const about = resolveAbout(coach);
  const locations = resolveLocationTags(coach);

  return (
    <article className="my-coaches__card">
      <div className="my-coaches__card-top">
        <div className="my-coaches__card-left">
          <img className="my-coaches__avatar" src={avatar} alt={`Portrait of ${name}`} />
          <div className="my-coaches__identity">
            <div className="my-coaches__name-row">
              <h3 className="my-coaches__name">{name}</h3>
              {status && <CoachStatusBadge status={status} />}
            </div>
            {rating && (
              <div className="my-coaches__rating">
                <Star size={16} className="my-coaches__rating-icon" />
                <span>{rating}</span>
              </div>
            )}
            {location && (
              <div className="my-coaches__meta">
                <MapPin size={14} />
                <span>{location}</span>
              </div>
            )}
            {distance && <div className="my-coaches__distance">{distance}</div>}
          </div>
        </div>
        {hourlyRate && <div className="my-coaches__rate">{hourlyRate}</div>}
      </div>

      {(about || locations.length > 0) && (
        <div className="my-coaches__details">
          {about && <p className="my-coaches__about">{about}</p>}
          {locations.length > 0 && (
            <div className="my-coaches__tags">
              {locations.map((loc) => (
                <span key={loc} className="my-coaches__tag">
                  {loc}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="my-coaches__actions">
        {coachId && (
          <Link className="my-coaches__button" to={`/coaches/${coachId}`}>
            View profile
          </Link>
        )}
      </div>
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
