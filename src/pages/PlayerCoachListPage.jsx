import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Calendar,
  Loader2,
  MapPin,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Star,
  Users2,
} from "lucide-react";
import api, { unwrap } from "../services/api";
import { useAuth } from "../context/AuthContext";
import useDebouncedValue from "../hooks/useDebouncedValue";
import "./PlayerCoachListPage.css";

const PER_PAGE = 10;
const DEFAULT_RADIUS = 10;

const buildQueryValue = (value) =>
  value !== undefined && value !== null ? String(value).trim() : "";

const parseCoachList = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.coaches)) return payload.coaches;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const parseNumber = (value) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeCoach = (coach) => {
  if (!coach || typeof coach !== "object") return null;
  const id =
    coach.id ??
    coach.coach_id ??
    coach.player_coach_id ??
    coach.user_id ??
    coach.uuid ??
    null;
  const firstName = coach.first_name ?? coach.firstName ?? "";
  const lastName = coach.last_name ?? coach.lastName ?? "";
  const displayName =
    coach.name ??
    coach.full_name ??
    coach.fullName ??
    coach.coach_name ??
    [firstName, lastName].filter(Boolean).join(" ");
  const hourlyRate =
    coach.hourly_rate ??
    coach.rate ??
    coach.hourlyRate ??
    coach.price_per_hour ??
    coach.hourly_price ??
    null;
  const hourlyRateValue = parseNumber(
    coach.hourly_rate ??
      coach.hourlyRate ??
      coach.price_per_hour ??
      coach.hourly_price ??
      coach.rate,
  );
  const avatar =
    coach.avatar ??
    coach.profile_image ??
    coach.profile_image_url ??
    coach.profilePhoto ??
    coach.photo ??
    "";
  const locationsRaw =
    coach.locations ??
    coach.locationList ??
    coach.location_list ??
    coach.location_names ??
    coach.locationName ??
    coach.coach_locations ??
    coach.coachLocations ??
    [];
  let locationList = [];
  if (Array.isArray(locationsRaw)) {
    locationList = locationsRaw.filter(Boolean).map(String);
  } else if (typeof locationsRaw === "string") {
    locationList = locationsRaw
      .split(/,|\n|\|/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  const bio =
    coach.bio ??
    coach.short_bio ??
    coach.description ??
    coach.about ??
    "";
  const ratingValue =
    parseNumber(
      coach.rating ??
        coach.average_rating ??
        coach.avg_rating ??
        coach.review_score ??
        coach.rating_value ??
        coach.score,
    ) ?? null;
  const ratingCount =
    parseNumber(
      coach.rating_count ??
        coach.reviews_count ??
        coach.review_count ??
        coach.ratings ??
        coach.total_reviews,
    ) ?? null;
  const specialtiesRaw =
    coach.specialties ??
    coach.speciality ??
    coach.expertise ??
    coach.tags ??
    coach.skill_tags ??
    coach.focus_areas ??
    [];
  let specialties = [];
  if (Array.isArray(specialtiesRaw)) {
    specialties = specialtiesRaw.filter(Boolean).map((item) => {
      if (typeof item === "string") return item.trim();
      if (typeof item === "object" && item !== null) {
        return (
          item.title ??
          item.name ??
          item.label ??
          item.value ??
          ""
        )
          .toString()
          .trim();
      }
      return String(item ?? "").trim();
    });
  } else if (typeof specialtiesRaw === "string") {
    specialties = specialtiesRaw
      .split(/,|\n|\|/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  const facility =
    coach.facility ??
    coach.club ??
    coach.club_name ??
    coach.location_name ??
    coach.primary_location ??
    null;
  const distanceValue =
    parseNumber(
      coach.distance ??
        coach.distance_miles ??
        coach.distanceMiles ??
        coach.distance_in_miles,
    ) ?? null;
  const distanceLabel =
    coach.distance_label ??
    coach.distanceLabel ??
    (distanceValue !== null
      ? `${distanceValue.toFixed(distanceValue >= 10 ? 0 : 1)} mi`
      : null);
  const availability =
    coach.availability ??
    coach.next_available ??
    coach.availability_summary ??
    coach.schedule_summary ??
    null;
  const lessonsCount =
    parseNumber(
      coach.lessons_booked ??
        coach.lessons_count ??
        coach.sessions_count ??
        coach.total_lessons,
    ) ?? null;
  const badge =
    coach.badge ??
    coach.highlight ??
    (coach.is_top_rated || (typeof ratingValue === "number" && ratingValue >= 4.8)
      ? "Top Rated"
      : null);
  const status = (coach.status ?? coach.coach_status ?? "").toString().toLowerCase();
  const slug = coach.slug ?? coach.username ?? id;
  const hourlyRateDisplay =
    typeof hourlyRate === "number"
      ? `$${hourlyRate.toFixed(0)}/hr`
      : hourlyRate && typeof hourlyRate === "string"
        ? hourlyRate
        : null;

  return {
    id,
    name: displayName || "Coach",
    hourlyRate: hourlyRateDisplay,
    hourlyRateValue,
    avatar,
    locationList,
    bio,
    ratingValue,
    ratingCount,
    specialties: specialties.filter(Boolean),
    facility,
    distanceLabel,
    availability,
    lessonsCount,
    badge: typeof badge === "string" && badge.trim() ? badge : null,
    status,
    slug,
  };
};

const FilterModal = ({
  title,
  isOpen,
  onClose,
  onClearAll,
  onDone,
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="filter-modal-overlay" role="dialog" aria-modal="true">
      <div className="filter-modal-content">
        <header className="filter-modal-header">
          <button
            type="button"
            className="filter-modal-clear"
            onClick={onClearAll}
          >
            Clear All
          </button>
          <h2>{title}</h2>
          <button type="button" className="filter-modal-done" onClick={onDone}>
            Done
          </button>
        </header>
        <div className="filter-modal-body">{children}</div>
      </div>
      <button
        type="button"
        className="filter-modal-backdrop"
        aria-label="Close filters"
        onClick={onClose}
      />
    </div>,
    document.body,
  );
};

const CoachCard = ({ coach, variant = "standard" }) => {
  const initials = useMemo(() => {
    if (!coach?.name) return "CC";
    const parts = coach.name
      .split(" ")
      .map((part) => part.trim())
      .filter(Boolean);
    if (!parts.length) return "CC";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }, [coach?.name]);

  const statusLabel = useMemo(() => {
    if (!coach?.status) return null;
    if (coach.status === "inactive") return "Inactive";
    if (coach.status === "pending") return "Pending";
    return null;
  }, [coach?.status]);

  const statusClass = useMemo(() => {
    if (!coach?.status) return "";
    if (coach.status === "inactive") return "coach-card-banner inactive";
    if (coach.status === "pending") return "coach-card-banner pending";
    return "";
  }, [coach?.status]);

  const ratingDisplay =
    typeof coach?.ratingValue === "number" && !Number.isNaN(coach.ratingValue)
      ? coach.ratingValue.toFixed(1)
      : null;
  const ratingCountDisplay =
    typeof coach?.ratingCount === "number" && coach.ratingCount > 0
      ? coach.ratingCount
      : null;
  const primaryLocation = coach?.facility || coach?.locationList?.[0] || null;
  const additionalLocations = coach?.locationList?.slice(1, 3) ?? [];
  const specialties = Array.isArray(coach?.specialties)
    ? coach.specialties.filter(Boolean).slice(0, variant === "featured" ? 4 : 3)
    : [];

  const lessonsDisplay =
    typeof coach?.lessonsCount === "number" && coach.lessonsCount > 0
      ? `${coach.lessonsCount.toLocaleString()} lessons`
      : null;

  return (
    <article className={`coach-card ${variant}`}>
      {statusLabel ? <div className={statusClass}>{statusLabel}</div> : null}
      {coach?.badge ? (
        <div className="coach-card-accent" aria-label={coach.badge}>
          {coach.badge}
        </div>
      ) : null}
      <div className="coach-card-main">
        <div className="coach-card-avatar" aria-hidden={coach.avatar ? undefined : true}>
          {coach.avatar ? (
            <img src={coach.avatar} alt={coach.name} loading="lazy" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div className="coach-card-body">
          <header className="coach-card-header">
            <div className="coach-card-title">
              <h3>{coach.name}</h3>
              {ratingDisplay ? (
                <div
                  className="coach-card-rating"
                  aria-label={`Rated ${ratingDisplay} out of 5${
                    ratingCountDisplay ? ` from ${ratingCountDisplay} reviews` : ""
                  }`}
                >
                  <Star size={16} aria-hidden />
                  <span>{ratingDisplay}</span>
                  {ratingCountDisplay ? (
                    <span className="coach-card-rating-count">({ratingCountDisplay})</span>
                  ) : null}
                </div>
              ) : null}
            </div>
            {coach.hourlyRate ? (
              <span className="coach-card-rate">{coach.hourlyRate}</span>
            ) : null}
          </header>
          {coach.bio ? <p className="coach-card-bio">{coach.bio}</p> : null}
          {specialties.length ? (
            <ul className="coach-card-specialties" aria-label="Specialties">
              {specialties.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          <div className="coach-card-meta">
            {primaryLocation ? (
              <div className="coach-card-meta-item">
                <MapPin size={14} aria-hidden />
                <span>
                  {primaryLocation}
                  {coach.distanceLabel ? ` • ${coach.distanceLabel}` : ""}
                </span>
              </div>
            ) : null}
            {additionalLocations.length ? (
              <div className="coach-card-meta-item secondary" aria-label="Additional locations">
                {additionalLocations.map((location) => (
                  <span key={location}>{location}</span>
                ))}
              </div>
            ) : null}
            {coach.availability ? (
              <div className="coach-card-meta-item">
                <Calendar size={14} aria-hidden />
                <span>{coach.availability}</span>
              </div>
            ) : null}
            {lessonsDisplay ? (
              <div className="coach-card-meta-item">
                <Users2 size={14} aria-hidden />
                <span>{lessonsDisplay}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="coach-card-footer">
        <Link className="coach-card-cta" to={`/coaches/${coach.slug || coach.id}`}>
          View Profile
          <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
};

const PlayerCoachListPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("all");
  const [allCoachPlayers, setAllCoachPlayers] = useState([]);
  const [addedCoachPlayers, setAddedCoachPlayers] = useState([]);
  const [allCoachesPage, setAllCoachesPage] = useState(1);
  const [myCoachesPage, setMyCoachesPage] = useState(1);
  const [allMiniLoader, setAllMiniLoader] = useState(false);
  const [addedMiniLoader, setAddedMiniLoader] = useState(false);
  const [locationLoader, setLocationLoader] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isAllCoachesListEnd, setIsAllCoachesListEnd] = useState(false);
  const [isMyCoachesListEnd, setIsMyCoachesListEnd] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [myCoachesFilterText, setMyCoachesFilterText] = useState("");
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [locationFilter, setLocationFilter] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const [openFilter, setOpenFilter] = useState(null);
  const [dynamicFilters, setDynamicFilters] = useState([]);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [locationQuery, setLocationQuery] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [locationSuggestionLoading, setLocationSuggestionLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [locationPreview, setLocationPreview] = useState(null);
  const [focusFilterSection, setFocusFilterSection] = useState(null);
  const [resultsAnnouncement, setResultsAnnouncement] = useState("");
  const [specialtySelection, setSpecialtySelection] = useState([]);
  const [sortValue, setSortValue] = useState("recommended");

  const allListSentinelRef = useRef(null);
  const myListSentinelRef = useRef(null);
  const locationInputRef = useRef(null);
  const radiusInputRef = useRef(null);
  const nameFilterInputRef = useRef(null);
  const hasRequestedLocationRef = useRef(false);
  const dynamicFilterRefs = useRef({});

  const debouncedUserPos = useDebouncedValue(userPos, 400);
  const filtersSignature = useMemo(() => {
    const activeEntries = Object.entries(selectedFilters).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return Boolean(value);
    });
    if (!activeEntries.length) return "";
    return JSON.stringify(Object.fromEntries(activeEntries));
  }, [selectedFilters]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Location is not supported in this browser.");
      return;
    }
    setLocationLoader(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPos({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationPreview({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationFilter((prev) =>
          prev && prev.address
            ? prev
            : {
                address: "Current location",
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                isCurrentLocation: true,
              },
        );
        setLocationLoader(false);
      },
      (error) => {
        console.error("Failed to obtain location", error);
        setLocationError(error.message || "Unable to fetch location");
        setLocationLoader(false);
      },
      { enableHighAccuracy: true, maximumAge: 1000 * 60 * 5, timeout: 1000 * 20 },
    );
  }, []);

  useEffect(() => {
    if (hasRequestedLocationRef.current) return;
    hasRequestedLocationRef.current = true;
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    if (locationFilter) return;
    if (!debouncedUserPos?.latitude || !debouncedUserPos?.longitude) return;
    setLocationFilter({
      address: "Current location",
      latitude: debouncedUserPos.latitude,
      longitude: debouncedUserPos.longitude,
      isCurrentLocation: true,
    });
    setLocationPreview({
      latitude: debouncedUserPos.latitude,
      longitude: debouncedUserPos.longitude,
    });
    setLocationError("");
  }, [debouncedUserPos, locationFilter]);

  const canQueryAllCoaches = useMemo(() => {
    if (locationFilter?.latitude && locationFilter?.longitude) return true;
    if (debouncedUserPos?.latitude && debouncedUserPos?.longitude) return true;
    return false;
  }, [debouncedUserPos, locationFilter]);

  const dynamicFilterPills = useMemo(() => {
    return dynamicFilters.map((filter) => {
      const selection = selectedFilters[filter.key];
      let suffix = "";
      if (Array.isArray(selection) && selection.length) {
        suffix = `${selection.length}`;
      } else if (selection) {
        suffix = selection;
      }
      return {
        key: filter.key,
        label: suffix ? `${filter.title} • ${suffix}` : filter.title,
        isActive: Array.isArray(selection) ? selection.length > 0 : Boolean(selection),
      };
    });
  }, [dynamicFilters, selectedFilters]);

  const heroStats = useMemo(() => {
    const available = allCoachPlayers.length;
    const ratingValues = allCoachPlayers
      .map((coach) => coach.ratingValue)
      .filter((value) => typeof value === "number");
    const hourlyValues = allCoachPlayers
      .map((coach) => coach.hourlyRateValue)
      .filter((value) => typeof value === "number");
    const lessonsValues = allCoachPlayers
      .map((coach) => coach.lessonsCount)
      .filter((value) => typeof value === "number");
    const avgRating = ratingValues.length
      ? ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length
      : null;
    const avgRate = hourlyValues.length
      ? hourlyValues.reduce((sum, value) => sum + value, 0) / hourlyValues.length
      : null;
    const totalLessons = lessonsValues.length
      ? lessonsValues.reduce((sum, value) => sum + value, 0)
      : null;
    return {
      available,
      avgRating: avgRating ? avgRating.toFixed(1) : null,
      avgHourlyRate: avgRate ? `$${Math.round(avgRate)}/hr` : null,
      lessons: totalLessons ? totalLessons.toLocaleString() : null,
    };
  }, [allCoachPlayers]);

  const specialtyChips = useMemo(
    () => [
      { label: "Serve Technique", value: "serve-technique" },
      { label: "Match Strategy", value: "match-strategy" },
      { label: "Junior Development", value: "junior-development" },
      { label: "Beginner Friendly", value: "beginner-friendly" },
      { label: "Doubles Strategy", value: "doubles-strategy" },
      { label: "Mental Game", value: "mental-game" },
    ],
    [],
  );

  const toggleSpecialty = useCallback((value) => {
    setSpecialtySelection((prev) => {
      if (prev.includes(value)) {
        return prev.filter((item) => item !== value);
      }
      return [...prev, value];
    });
  }, []);

  const handleSortChange = useCallback((event) => {
    setSortValue(event.target.value);
  }, []);

  const handleSearchChange = useCallback((event) => {
    setNameDraft(event.target.value);
  }, []);

  const resultsCount = activeTab === "all" ? allCoachPlayers.length : addedCoachPlayers.length;

  useEffect(() => {
    const count = activeTab === "all" ? allCoachPlayers.length : addedCoachPlayers.length;
    setResultsAnnouncement(`${count} coach${count === 1 ? "" : "es"} found`);
  }, [activeTab, addedCoachPlayers.length, allCoachPlayers.length]);

  const resetAllPagination = useCallback(() => {
    setAllCoachesPage(1);
    setIsAllCoachesListEnd(false);
  }, []);

  const resetMyPagination = useCallback(() => {
    setMyCoachesPage(1);
    setIsMyCoachesListEnd(false);
  }, []);

  const buildFilterQueryParam = useCallback(() => {
    if (!filtersSignature) return "";
    return `&filters=${encodeURIComponent(filtersSignature)}`;
  }, [filtersSignature]);

  const buildFilterBody = useCallback(() => {
    if (!filtersSignature) return undefined;
    try {
      return JSON.parse(filtersSignature);
    } catch {
      return undefined;
    }
  }, [filtersSignature]);

  const fetchDynamicFilters = useCallback(async () => {
    try {
      const response = await unwrap(api("/player/filters"));
      const items = parseCoachList(response).length
        ? parseCoachList(response)
        : Array.isArray(response?.filters)
          ? response.filters
          : [];
      const normalized = items
        .map((item) => ({
          key: item.key ?? item.id ?? item.slug,
          title: item.title ?? item.name ?? item.label ?? "Filter",
          filterType: (() => {
            const rawType = (item.filterType ?? item.type ?? "single").toLowerCase();
            if (rawType === "multiple" || rawType === "multi-select") return "multi";
            return rawType;
          })(),
          options:
            Array.isArray(item.options) && item.options.length
              ? item.options
              : Array.isArray(item.values)
                ? item.values
                : [],
        }))
        .filter((item) => item.key);
      setDynamicFilters(normalized);
    } catch (error) {
      console.error("Failed to fetch dynamic filters", error);
    }
  }, []);

  useEffect(() => {
    fetchDynamicFilters();
  }, [fetchDynamicFilters]);

  useEffect(() => {
    if (openFilter === "filters") {
      setLocationQuery(locationFilter?.address ?? "");
      setLocationPreview(
        locationFilter?.latitude && locationFilter?.longitude
          ? {
              latitude: locationFilter.latitude,
              longitude: locationFilter.longitude,
            }
          : debouncedUserPos || null,
      );
      setLocationError("");
      setNameDraft(activeTab === "all" ? filterText : myCoachesFilterText);
    }
  }, [
    activeTab,
    debouncedUserPos,
    filterText,
    locationFilter,
    myCoachesFilterText,
    openFilter,
  ]);

  useEffect(() => {
    if (openFilter !== "filters") {
      setLocationSuggestions([]);
    }
  }, [openFilter]);

  useEffect(() => {
    if (openFilter !== "filters") return;
    const trimmed = locationQuery.trim();
    if (trimmed.length < 3) {
      setLocationSuggestions([]);
      return;
    }
    let cancelled = false;
    setLocationSuggestionLoading(true);
    unwrap(
      api(
        `/player/locations-geojson?search=${encodeURIComponent(trimmed)}`,
        {
          method: "GET",
        },
      ),
    )
      .then((data) => {
        if (cancelled) return;
        const features = Array.isArray(data?.features)
          ? data.features
          : Array.isArray(data?.data)
            ? data.data
            : [];
        const mapped = features
          .map((feature) => {
            const properties = feature.properties ?? feature;
            const geometry = feature.geometry ?? {};
            const coordinates = geometry.coordinates ?? [];
            const latitude = coordinates[1] ?? properties.latitude ?? null;
            const longitude = coordinates[0] ?? properties.longitude ?? null;
            const label =
              properties.label ??
              properties.title ??
              properties.name ??
              feature.label ??
              feature.name ??
              "";
            if (!label) return null;
            return {
              id: feature.id ?? properties.id ?? label,
              label,
              latitude,
              longitude,
            };
          })
          .filter(Boolean);
        setLocationSuggestions(mapped);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Location search failed", error);
        setLocationSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) {
          setLocationSuggestionLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [locationQuery, openFilter]);

  useEffect(() => {
    if (openFilter === "filters") return;
    if (focusFilterSection === null) return;
    setFocusFilterSection(null);
  }, [focusFilterSection, openFilter]);

  useEffect(() => {
    if (openFilter !== "filters") return;
    const timer = window.setTimeout(() => {
      if (focusFilterSection === "location" && locationInputRef.current) {
        locationInputRef.current.focus();
      } else if (focusFilterSection === "radius" && radiusInputRef.current) {
        radiusInputRef.current.focus();
      } else if (focusFilterSection === "name" && nameFilterInputRef.current) {
        nameFilterInputRef.current.focus();
      } else if (focusFilterSection && dynamicFilterRefs.current[focusFilterSection]) {
        const node = dynamicFilterRefs.current[focusFilterSection];
        if (node?.scrollIntoView) {
          node.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        if (node?.focus) {
          node.focus();
        }
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [
    dynamicFilterRefs,
    focusFilterSection,
    locationInputRef,
    nameFilterInputRef,
    openFilter,
    radiusInputRef,
  ]);

  const normalizeListResponse = useCallback(
    (payload) =>
      parseCoachList(payload)
        .map(normalizeCoach)
        .filter((coach) => coach && coach.id && coach.id !== user?.id),
    [user?.id],
  );

  const fetchAllCoaches = useCallback(
    async ({ page = 1, append = false } = {}) => {
      if (!canQueryAllCoaches) {
        setAllCoachPlayers([]);
        setIsAllCoachesListEnd(false);
        return;
      }
      setAllMiniLoader(true);
      if (!append) {
        setIsAllCoachesListEnd(false);
      }
      const position = locationFilter?.latitude
        ? {
            latitude: locationFilter.latitude,
            longitude: locationFilter.longitude,
            latitudeDelta: 0.25,
            longitudeDelta: 0.25,
          }
        : debouncedUserPos
          ? {
              latitude: debouncedUserPos.latitude,
              longitude: debouncedUserPos.longitude,
              latitudeDelta: 0.25,
              longitudeDelta: 0.25,
            }
          : null;
      try {
        const searchTerm = buildQueryValue(filterText);
        const locationSearch = locationFilter?.isCurrentLocation
          ? ""
          : locationFilter?.address?.toLowerCase() === "current location"
            ? ""
            : buildQueryValue(locationFilter?.address);
        const response = await unwrap(
          api(
            `/player/getchecklocation?perPage=${PER_PAGE}&page=${page}&search=${encodeURIComponent(searchTerm)}&locationSearch=${encodeURIComponent(locationSearch)}&radius=${encodeURIComponent(radius)}${buildFilterQueryParam()}`,
            {
              method: "POST",
              json: {
                position,
                filters: buildFilterBody(),
              },
            },
          ),
        );
        const normalized = normalizeListResponse(response);
        setAllCoachPlayers((prev) =>
          append ? [...prev, ...normalized] : [...normalized],
        );
        setIsAllCoachesListEnd(normalized.length < PER_PAGE);
        if (!append) {
          setAllCoachesPage(1);
        }
      } catch (error) {
        console.error("Failed to load coaches", error);
        if (!append) {
          setAllCoachPlayers([]);
        }
      } finally {
        setAllMiniLoader(false);
      }
    },
    [
      buildFilterBody,
      buildFilterQueryParam,
      canQueryAllCoaches,
      debouncedUserPos,
      filterText,
      locationFilter,
      normalizeListResponse,
      radius,
    ],
  );

  const fetchMyCoaches = useCallback(
    async ({ page = 1, append = false } = {}) => {
      setAddedMiniLoader(true);
      if (!append) {
        setIsMyCoachesListEnd(false);
      }
      try {
        const searchTerm = buildQueryValue(myCoachesFilterText);
        const locationSearch = locationFilter?.isCurrentLocation
          ? ""
          : locationFilter?.address?.toLowerCase() === "current location"
            ? ""
            : buildQueryValue(locationFilter?.address);
        const response = await unwrap(
          api(
            `/player/coaches?perPage=${PER_PAGE}&page=${page}&search=${encodeURIComponent(searchTerm)}&locationSearch=${encodeURIComponent(locationSearch)}${buildFilterQueryParam()}`,
            {
              method: "GET",
            },
          ),
        );
        const normalized = normalizeListResponse(response);
        setAddedCoachPlayers((prev) =>
          append ? [...prev, ...normalized] : [...normalized],
        );
        setIsMyCoachesListEnd(normalized.length < PER_PAGE);
        if (!append) {
          setMyCoachesPage(1);
        }
      } catch (error) {
        console.error("Failed to load added coaches", error);
        if (!append) {
          setAddedCoachPlayers([]);
        }
      } finally {
        setAddedMiniLoader(false);
      }
    },
    [
      buildFilterQueryParam,
      locationFilter?.address,
      myCoachesFilterText,
      normalizeListResponse,
    ],
  );

  useEffect(() => {
    if (activeTab !== "all") return;
    if (!canQueryAllCoaches) return;
    fetchAllCoaches({ page: 1, append: false });
  }, [
    activeTab,
    canQueryAllCoaches,
    fetchAllCoaches,
    filterText,
    radius,
    locationFilter,
    filtersSignature,
  ]);

  useEffect(() => {
    if (activeTab !== "my") return;
    fetchMyCoaches({ page: 1, append: false });
  }, [activeTab, fetchMyCoaches, myCoachesFilterText, locationFilter, filtersSignature]);

  useEffect(() => {
    if (activeTab !== "all") return;
    if (allCoachesPage <= 1) return;
    fetchAllCoaches({ page: allCoachesPage, append: true });
  }, [activeTab, allCoachesPage, fetchAllCoaches]);

  useEffect(() => {
    if (activeTab !== "my") return;
    if (myCoachesPage <= 1) return;
    fetchMyCoaches({ page: myCoachesPage, append: true });
  }, [activeTab, fetchMyCoaches, myCoachesPage]);

  const loadMoreAllCoaches = useCallback(() => {
    if (allMiniLoader || isAllCoachesListEnd) return;
    setAllCoachesPage((prev) => prev + 1);
  }, [allMiniLoader, isAllCoachesListEnd]);

  const loadMoreMyCoaches = useCallback(() => {
    if (addedMiniLoader || isMyCoachesListEnd) return;
    setMyCoachesPage((prev) => prev + 1);
  }, [addedMiniLoader, isMyCoachesListEnd]);

  useEffect(() => {
    if (activeTab !== "all") return;
    const node = allListSentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        loadMoreAllCoaches();
      }
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [activeTab, allCoachPlayers.length, loadMoreAllCoaches]);

  useEffect(() => {
    if (activeTab !== "my") return;
    const node = myListSentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        loadMoreMyCoaches();
      }
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [activeTab, addedCoachPlayers.length, loadMoreMyCoaches]);

  const handleLocationSelect = useCallback((suggestion) => {
    setLocationFilter({
      address: suggestion.label,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      isCurrentLocation: false,
    });
    if (suggestion.latitude && suggestion.longitude) {
      setLocationPreview({
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
      });
    }
  }, []);

  const commitNameFilter = useCallback(() => {
    if (activeTab === "all") {
      setFilterText(nameDraft.trim());
      resetAllPagination();
    } else {
      setMyCoachesFilterText(nameDraft.trim());
      resetMyPagination();
    }
  }, [activeTab, nameDraft, resetAllPagination, resetMyPagination]);

  const handleSearchSubmit = useCallback(
    (event) => {
      event.preventDefault();
      commitNameFilter();
    },
    [commitNameFilter],
  );

  const handleSearchClear = useCallback(() => {
    setNameDraft("");
    if (activeTab === "all") {
      setFilterText("");
      resetAllPagination();
    } else {
      setMyCoachesFilterText("");
      resetMyPagination();
    }
  }, [activeTab, resetAllPagination, resetMyPagination]);

  const handleFiltersClear = useCallback(() => {
    if (debouncedUserPos?.latitude && debouncedUserPos?.longitude) {
      setLocationFilter({
        address: "Current location",
        latitude: debouncedUserPos.latitude,
        longitude: debouncedUserPos.longitude,
        isCurrentLocation: true,
      });
      setLocationPreview({
        latitude: debouncedUserPos.latitude,
        longitude: debouncedUserPos.longitude,
      });
    } else {
      setLocationFilter(null);
      setLocationPreview(null);
    }
    setLocationQuery("");
    setLocationSuggestions([]);
    setLocationError("");
    setRadius(DEFAULT_RADIUS);
    setNameDraft("");
    setFilterText("");
    setMyCoachesFilterText("");
    setSelectedFilters({});
    setSpecialtySelection([]);
    resetAllPagination();
    resetMyPagination();
  }, [
    debouncedUserPos,
    resetAllPagination,
    resetMyPagination,
  ]);

  const handleFiltersDone = useCallback(() => {
    commitNameFilter();
    setOpenFilter(null);
    setFocusFilterSection(null);
  }, [commitNameFilter]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (activeTab === "all") {
        await fetchAllCoaches({ page: 1, append: false });
      } else {
        await fetchMyCoaches({ page: 1, append: false });
      }
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, fetchAllCoaches, fetchMyCoaches]);

  const shouldShowLocationPrompt =
    activeTab === "all" && !canQueryAllCoaches && !locationLoader;

  useEffect(() => {
    if (activeTab === "all" && !canQueryAllCoaches) {
      setAllCoachPlayers([]);
      setIsAllCoachesListEnd(false);
    }
  }, [activeTab, canQueryAllCoaches]);

  const activeList = activeTab === "all" ? allCoachPlayers : addedCoachPlayers;
  const isActiveLoading = activeTab === "all" ? allMiniLoader : addedMiniLoader;
  const activeListEnd = activeTab === "all" ? isAllCoachesListEnd : isMyCoachesListEnd;
  const activeSentinelRef = activeTab === "all" ? allListSentinelRef : myListSentinelRef;
  const featuredCoaches = activeTab === "all" ? activeList.slice(0, 2) : [];
  const remainingCoaches = activeTab === "all" ? activeList.slice(2) : activeList;
  const resultsHeading = activeTab === "all" ? "All Coaches" : "My Coaches";
  const resultsDescription =
    activeTab === "all"
      ? "Browse certified coaches tailored to your goals."
      : "Coaches you have already connected with.";
  const showInitialLoader = isActiveLoading && !activeList.length;
  const showEmptyState = !isActiveLoading && !activeList.length;

  const renderDynamicFilterControls = (filter) => {
    const selection = selectedFilters[filter.key] ?? (filter.filterType === "multi" ? [] : "");
    if (filter.filterType === "multi") {
      return (
        <div className="filter-options">
          {filter.options.map((option) => {
            const optionValue =
              typeof option === "object" && option !== null
                ? option.value ?? option.id ?? option.slug ?? option.label ?? option.name
                : option;
            const value = optionValue ?? option;
            const label =
              typeof option === "object" && option !== null
                ? option.label ?? option.name ?? option.title ?? String(value)
                : String(option ?? value ?? "");
            const checked = Array.isArray(selection) && selection.includes(value);
            return (
              <label key={value} className="filter-option">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const { checked: isChecked } = event.target;
                    setSelectedFilters((prev) => {
                      const current = Array.isArray(prev[filter.key])
                        ? [...prev[filter.key]]
                        : [];
                      if (isChecked) {
                        current.push(value);
                        return {
                          ...prev,
                          [filter.key]: Array.from(new Set(current)),
                        };
                      }
                      const reduced = current.filter((item) => item !== value);
                      if (!reduced.length) {
                        const next = { ...prev };
                        delete next[filter.key];
                        return next;
                      }
                      return {
                        ...prev,
                        [filter.key]: reduced,
                      };
                    });
                  }}
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      );
    }

    return (
      <div className="filter-options">
        {filter.options.map((option) => {
          const optionValue =
            typeof option === "object" && option !== null
              ? option.value ?? option.id ?? option.slug ?? option.label ?? option.name
              : option;
          const value = optionValue ?? option;
          const label =
            typeof option === "object" && option !== null
              ? option.label ?? option.name ?? option.title ?? String(value)
              : String(option ?? value ?? "");
          return (
            <label key={value} className="filter-option">
              <input
                type="radio"
                name={`filter-${filter.key}`}
                checked={selection === value}
                onChange={() => {
                  setSelectedFilters((prev) => ({
                    ...prev,
                    [filter.key]: value,
                  }));
                }}
              />
              <span>{label}</span>
            </label>
          );
        })}
      </div>
    );
  };

  return (
    <div className="coach-list-page">
      <header className="coach-hero">
        <div className="coach-hero-copy">
          <p className="coach-hero-eyebrow">Player Experience</p>
          <h1>Find Your Perfect Coach</h1>
          <p className="coach-hero-subtitle">
            Get matched with certified tennis professionals in your area.
          </p>
          <div className="coach-tab-bar" role="tablist" aria-label="Coach views">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "all"}
              className={`coach-tab${activeTab === "all" ? " active" : ""}`}
              onClick={() => {
                setActiveTab("all");
                resetAllPagination();
              }}
            >
              <Users2 size={16} aria-hidden />
              All Coaches
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "my"}
              className={`coach-tab${activeTab === "my" ? " active" : ""}`}
              onClick={() => {
                setActiveTab("my");
                resetMyPagination();
              }}
            >
              <SlidersHorizontal size={16} aria-hidden />
              My Coaches
            </button>
          </div>
        </div>
        <dl className="coach-hero-stats">
          <div className="coach-hero-stat">
            <dt>Available Coaches</dt>
            <dd>{heroStats.available.toLocaleString()}</dd>
          </div>
          <div className="coach-hero-stat">
            <dt>Avg Rating</dt>
            <dd>{heroStats.avgRating ?? "—"}</dd>
          </div>
          <div className="coach-hero-stat">
            <dt>Avg Hourly Rate</dt>
            <dd>{heroStats.avgHourlyRate ?? "—"}</dd>
          </div>
          <div className="coach-hero-stat">
            <dt>Lessons Booked</dt>
            <dd>{heroStats.lessons ?? "—"}</dd>
          </div>
        </dl>
      </header>

      <section className="coach-controls" aria-label="Search and filters">
        <div className="coach-controls-bar">
          <button
            type="button"
            className="coach-location-trigger"
            onClick={() => {
              setFocusFilterSection("location");
              setOpenFilter("filters");
            }}
            aria-label={
              locationFilter?.address
                ? `Change location from ${locationFilter.address}`
                : "Select a location"
            }
            aria-haspopup="dialog"
          >
            <MapPin size={16} aria-hidden />
            <span>
              {locationFilter?.address
                ? locationFilter.address
                : debouncedUserPos?.latitude && debouncedUserPos?.longitude
                  ? "Current location"
                  : "Select location"}
            </span>
          </button>
          <form className="coach-search" role="search" onSubmit={handleSearchSubmit}>
            <Search size={16} aria-hidden />
            <input
              type="search"
              value={nameDraft}
              onChange={handleSearchChange}
              placeholder="Search coaches by name…"
              aria-label="Search coaches by name"
            />
            {nameDraft ? (
              <button type="button" className="coach-search-clear" onClick={handleSearchClear}>
                <span className="sr-only">Clear search</span>
                ×
              </button>
            ) : null}
          </form>
          <button
            type="button"
            className="coach-filters-toggle"
            onClick={() => {
              setFocusFilterSection(null);
              setOpenFilter("filters");
            }}
            aria-haspopup="dialog"
            aria-expanded={openFilter === "filters"}
          >
            <SlidersHorizontal size={16} aria-hidden />
            Filters
          </button>
          <div className="coach-sort">
            <label htmlFor="coach-sort-select">Sort by</label>
            <select
              id="coach-sort-select"
              value={sortValue}
              onChange={handleSortChange}
              aria-label="Sort coaches"
            >
              <option value="recommended">Recommended</option>
              <option value="price">Price</option>
              <option value="rating">Rating</option>
              <option value="distance">Distance</option>
            </select>
          </div>
        </div>
        <div
          id="coach-specialty-chips"
          className="coach-chip-toolbar"
          role="toolbar"
          aria-label="Specialty filters"
        >
          {specialtyChips.map((chip) => {
            const isSelected = specialtySelection.includes(chip.value);
            return (
              <button
                key={chip.value}
                type="button"
                className={`coach-chip${isSelected ? " selected" : ""}`}
                onClick={() => toggleSpecialty(chip.value)}
                aria-pressed={isSelected}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
        {dynamicFilterPills.some((pill) => pill.isActive) ? (
          <div className="coach-active-filters" role="list" aria-label="Active filters">
            {dynamicFilterPills
              .filter((pill) => pill.isActive)
              .map((pill) => (
                <button
                  type="button"
                  key={pill.key}
                  className="filter-pill"
                  role="listitem"
                  onClick={() => {
                    setFocusFilterSection(pill.key);
                    setOpenFilter("filters");
                  }}
                  aria-haspopup="dialog"
                >
                  <span>{pill.label}</span>
                </button>
              ))}
          </div>
        ) : null}
      </section>

      <div className="coach-results-header">
        <div>
          <h2>{resultsHeading}</h2>
          <p>{resultsDescription}</p>
        </div>
        <div className="coach-results-meta">
          <span className="coach-results-count" aria-live="polite">
            {resultsCount.toLocaleString()} results
          </span>
          <button
            type="button"
            className={`refresh-button${refreshing ? " refreshing" : ""}`}
            onClick={handleRefresh}
          >
            <RefreshCcw size={16} aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      <section className="coach-results" aria-label="Coach results">
        <div className="sr-only" role="status" aria-live="polite">
          {resultsAnnouncement}
        </div>

        {shouldShowLocationPrompt ? (
          <div className="location-permission-card">
            <div className="location-permission-copy">
              <h3>Enable location to find nearby coaches</h3>
              <p>
                Turn on your device location or pick a location to see coaches close to you.
              </p>
              {locationError ? <p className="location-error">{locationError}</p> : null}
            </div>
            <div className="location-permission-actions">
              <button type="button" className="primary" onClick={requestLocation}>
                {locationLoader ? <Loader2 className="spin" size={16} aria-hidden /> : null}
                Enable Location
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setFocusFilterSection("location");
                  setOpenFilter("filters");
                }}
              >
                Enter Manually
              </button>
            </div>
          </div>
        ) : null}

        {!shouldShowLocationPrompt && showInitialLoader ? (
          <div className="coach-list-loader">
            <Loader2 className="spin" size={32} aria-hidden />
            <p>Loading coaches…</p>
          </div>
        ) : null}

        {!shouldShowLocationPrompt && !showInitialLoader && showEmptyState ? (
          <div className="coach-list-empty">No coaches found.</div>
        ) : null}

        {!shouldShowLocationPrompt && !showInitialLoader && !showEmptyState ? (
          <Fragment>
            {activeTab === "all" && featuredCoaches.length ? (
              <section className="coach-section" aria-labelledby="featured-coaches-heading">
                <div className="coach-section-header">
                  <h3 id="featured-coaches-heading">Featured Coaches</h3>
                  <p>Coaches with outstanding reviews and engagement.</p>
                </div>
                <div className="coach-featured-grid">
                  {featuredCoaches.map((coach) => (
                    <CoachCard key={`featured-${coach.id}`} coach={coach} variant="featured" />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="coach-section" aria-labelledby="all-coaches-heading">
              <div className="coach-section-header">
                <h3 id="all-coaches-heading">{resultsHeading}</h3>
                <p>{resultsDescription}</p>
              </div>
              <div className={`coach-grid ${activeTab === "all" ? "all" : "mine"}`}>
                {remainingCoaches.map((coach) => (
                  <CoachCard
                    key={coach.id}
                    coach={coach}
                    variant={activeTab === "all" ? "standard" : "compact"}
                  />
                ))}
              </div>
              <div ref={activeSentinelRef} className="list-sentinel" aria-hidden>
                {isActiveLoading && activeList.length ? (
                  <Loader2 className="spin" size={20} aria-hidden />
                ) : null}
                {activeListEnd ? <span>End of results</span> : null}
              </div>
            </section>
          </Fragment>
        ) : null}
      </section>

      <FilterModal
        title="Filters"
        isOpen={openFilter === "filters"}
        onClose={() => setOpenFilter(null)}
        onClearAll={handleFiltersClear}
        onDone={handleFiltersDone}
      >
        <div className="filters-panel">
          <section className="filter-group" aria-labelledby="filter-location-heading">
            <div className="filter-group-header">
              <h3 id="filter-location-heading">Location</h3>
              <p>Choose where to search from.</p>
            </div>
            <label className="field-label" htmlFor="coach-location-search">
              Search address
            </label>
            <div className="field-with-icon">
              <Search size={16} aria-hidden />
              <input
                id="coach-location-search"
                ref={locationInputRef}
                type="text"
                value={locationQuery}
                placeholder="Search for a city, club, or court"
                onChange={(event) => setLocationQuery(event.target.value)}
              />
            </div>
            <button type="button" className="use-my-location" onClick={requestLocation}>
              Use my current location
            </button>
            {locationSuggestionLoading ? (
              <div className="location-suggestions loading">
                <Loader2 className="spin" size={16} aria-hidden /> Searching…
              </div>
            ) : null}
            {locationSuggestions.length ? (
              <ul className="location-suggestions">
                {locationSuggestions.map((suggestion) => (
                  <li key={suggestion.id}>
                    <button
                      type="button"
                      onClick={() => {
                        handleLocationSelect(suggestion);
                        setLocationQuery(suggestion.label);
                      }}
                    >
                      <MapPin size={16} aria-hidden />
                      <span>{suggestion.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="location-preview">
              <h4>Selected location</h4>
              {locationFilter?.address ? (
                <p>{locationFilter.address}</p>
              ) : locationPreview?.latitude && locationPreview?.longitude ? (
                <p>
                  Lat {locationPreview.latitude.toFixed(4)}, Lng {" "}
                  {locationPreview.longitude.toFixed(4)}
                </p>
              ) : (
                <p>No location selected yet.</p>
              )}
              {locationError ? <p className="location-error">{locationError}</p> : null}
            </div>
          </section>

          <section className="filter-group" aria-labelledby="filter-radius-heading">
            <div className="filter-group-header">
              <h3 id="filter-radius-heading">Radius</h3>
              <p>Adjust how far to search from your location.</p>
            </div>
            <div className="radius-filter">
              <div className="radius-value">
                <span>{radius} miles</span>
              </div>
              <input
                ref={radiusInputRef}
                type="range"
                min="1"
                max="100"
                value={radius}
                onChange={(event) => setRadius(Number(event.target.value))}
                onMouseUp={(event) => setRadius(Number(event.target.value))}
                onTouchEnd={(event) => setRadius(Number(event.target.value))}
                aria-label="Search radius in miles"
              />
              <p className="radius-hint">Adjust the search radius to expand or narrow results.</p>
            </div>
          </section>

          <section className="filter-group" aria-labelledby="filter-name-heading">
            <div className="filter-group-header">
              <h3 id="filter-name-heading">Name</h3>
              <p>Filter coaches by name to find a specific pro.</p>
            </div>
            <label className="field-label" htmlFor="coach-name-filter">
              Coach name
            </label>
            <input
              id="coach-name-filter"
              ref={nameFilterInputRef}
              type="text"
              value={nameDraft}
              placeholder="Search by coach name"
              onChange={(event) => setNameDraft(event.target.value)}
              className="filter-text-input"
            />
            <button type="button" className="apply-button" onClick={commitNameFilter}>
              Apply name filter
            </button>
          </section>

          {dynamicFilters.length ? (
            <section className="filter-group" aria-labelledby="filter-more-heading">
              <div className="filter-group-header">
                <h3 id="filter-more-heading">Additional filters</h3>
                <p>Refine by specialties, programs, and more.</p>
              </div>
              <div className="dynamic-filter-list">
                {dynamicFilters.map((filter) => (
                  <div
                    key={filter.key}
                    className="dynamic-filter-group"
                    ref={(node) => {
                      if (node) {
                        dynamicFilterRefs.current[filter.key] = node;
                      } else {
                        delete dynamicFilterRefs.current[filter.key];
                      }
                    }}
                    tabIndex={-1}
                    data-filter-key={filter.key}
                    role="group"
                    aria-labelledby={`filter-${filter.key}-heading`}
                  >
                    <h4 id={`filter-${filter.key}-heading`}>{filter.title}</h4>
                    {filter.options?.length ? (
                      renderDynamicFilterControls(filter)
                    ) : (
                      <p className="filter-empty">No options available.</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </FilterModal>
    </div>
  );
};

export default PlayerCoachListPage;
