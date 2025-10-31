import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Loader2,
  MapPin,
  RefreshCcw,
  Search,
  Star,
  Target,
  Users,
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
    avatar,
    locationList,
    bio,
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

  const coachKey = coach?.slug || coach?.id || coach?.name || "";
  const avatarContent = coach?.avatar ? (
    <img src={coach.avatar} alt={coach.name} loading="lazy" />
  ) : (
    <span>{initials}</span>
  );

  return (
    <article className={`coach-card coach-card--${variant}`} data-coach-id={coachKey}>
      {statusLabel ? <div className={`coach-card-status coach-card-status--${coach.status}`}>{statusLabel}</div> : null}
      <header className="coach-card__header">
        <div className={`coach-card__avatar${coach?.avatar ? " coach-card__avatar--image" : ""}`}>
          {avatarContent}
        </div>
        {variant === "featured" ? (
          <span className="coach-card__badge">
            <BadgeCheck size={16} />
            Certified Coach
          </span>
        ) : null}
      </header>
      <div className="coach-card__body">
        <div className="coach-card__title-row">
          <h3>{coach.name}</h3>
          {coach.hourlyRate ? <span className="coach-card__rate">{coach.hourlyRate}</span> : null}
        </div>
        {coach.bio ? <p className="coach-card__bio">{coach.bio}</p> : null}
        {coach.locationList?.length ? (
          <div className="coach-card__tags">
            {coach.locationList.slice(0, variant === "featured" ? 3 : 2).map((location) => (
              <span key={`${coachKey}-${location}`} className="coach-card__tag">
                <MapPin size={14} />
                {location}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <footer className="coach-card__footer">
        <Link className="coach-card__cta" to={`/coaches/${coach.slug || coach.id}`}>
          View Profile
          <ArrowRight size={16} />
        </Link>
      </footer>
    </article>
  );
};

const PlayerCoachListPage = () => {
  const { user } = useAuth();
  const [allCoachPlayers, setAllCoachPlayers] = useState([]);
  const [addedCoachPlayers, setAddedCoachPlayers] = useState([]);
  const [allCoachesPage, setAllCoachesPage] = useState(1);
  const [allMiniLoader, setAllMiniLoader] = useState(false);
  const [locationLoader, setLocationLoader] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isAllCoachesListEnd, setIsAllCoachesListEnd] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [sortOption, setSortOption] = useState("recommended");
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

  const allListSentinelRef = useRef(null);

  const debouncedUserPos = useDebouncedValue(userPos, 400);
  const filtersSignature = useMemo(() => {
    const activeEntries = Object.entries(selectedFilters).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return Boolean(value);
    });
    if (!activeEntries.length) return "";
    return JSON.stringify(Object.fromEntries(activeEntries));
  }, [selectedFilters]);

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

  const resetAllPagination = useCallback(() => {
    setAllCoachesPage(1);
    setIsAllCoachesListEnd(false);
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
    if (openFilter === "location") {
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
    }
    if (openFilter === "name") {
      setNameDraft(filterText);
    }
  }, [debouncedUserPos, filterText, locationFilter, openFilter]);

  useEffect(() => {
    if (openFilter !== "location") {
      setLocationSuggestions([]);
    }
  }, [openFilter]);

  useEffect(() => {
    if (openFilter !== "location") return;
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
        const locationSearch = buildQueryValue(locationFilter?.address);
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

  const fetchMyCoaches = useCallback(async () => {
    try {
      const searchTerm = buildQueryValue(filterText);
      const locationSearch = buildQueryValue(locationFilter?.address);
      const response = await unwrap(
        api(
          `/player/coaches?perPage=${PER_PAGE}&page=1&search=${encodeURIComponent(searchTerm)}&locationSearch=${encodeURIComponent(locationSearch)}${buildFilterQueryParam()}`,
          {
            method: "GET",
          },
        ),
      );
      const normalized = normalizeListResponse(response);
      setAddedCoachPlayers(normalized);
    } catch (error) {
      console.error("Failed to load added coaches", error);
      setAddedCoachPlayers([]);
    }
  }, [
    buildFilterQueryParam,
    filterText,
    locationFilter?.address,
    normalizeListResponse,
  ]);

  useEffect(() => {
    if (!canQueryAllCoaches) return;
    fetchAllCoaches({ page: 1, append: false });
  }, [
    canQueryAllCoaches,
    fetchAllCoaches,
    filterText,
    radius,
    locationFilter,
    filtersSignature,
  ]);

  useEffect(() => {
    fetchMyCoaches();
  }, [fetchMyCoaches]);

  useEffect(() => {
    if (allCoachesPage <= 1) return;
    fetchAllCoaches({ page: allCoachesPage, append: true });
  }, [allCoachesPage, fetchAllCoaches]);


  const loadMoreAllCoaches = useCallback(() => {
    if (allMiniLoader || isAllCoachesListEnd) return;
    setAllCoachesPage((prev) => prev + 1);
  }, [allMiniLoader, isAllCoachesListEnd]);

  useEffect(() => {
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
  }, [allCoachPlayers.length, loadMoreAllCoaches]);

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

  const handleLocationSelect = useCallback((suggestion) => {
    setLocationFilter({
      address: suggestion.label,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
    if (suggestion.latitude && suggestion.longitude) {
      setLocationPreview({
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
      });
    }
  }, []);

  const handleRadiusChange = useCallback((value) => {
    setRadius(value);
  }, []);

  const handleNameApply = useCallback(() => {
    setFilterText(nameDraft.trim());
    resetAllPagination();
    setOpenFilter(null);
  }, [nameDraft, resetAllPagination]);

  const handleClearFilter = useCallback(() => {
    if (openFilter === "location") {
      setLocationFilter(null);
      setLocationPreview(debouncedUserPos || null);
      setLocationQuery("");
    }
    if (openFilter === "radius") {
      setRadius(DEFAULT_RADIUS);
    }
    if (openFilter === "name") {
      setNameDraft("");
      setFilterText("");
    }
    if (dynamicFilters.some((filter) => filter.key === openFilter)) {
      setSelectedFilters((prev) => {
        const next = { ...prev };
        delete next[openFilter];
        return next;
      });
    }
  }, [debouncedUserPos, dynamicFilters, openFilter]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchAllCoaches({ page: 1, append: false }),
        fetchMyCoaches(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchAllCoaches, fetchMyCoaches]);

  const shouldShowLocationPrompt = !canQueryAllCoaches && !locationLoader;

  useEffect(() => {
    if (!canQueryAllCoaches) {
      setAllCoachPlayers([]);
      setIsAllCoachesListEnd(false);
    }
  }, [canQueryAllCoaches]);

  const pills = [
    {
      key: "location",
      label: locationFilter?.address ? `Location • ${locationFilter.address}` : "Location",
      isActive: Boolean(locationFilter?.address),
    },
    {
      key: "radius",
      label: `Radius • ${radius} mi`,
      isActive: radius !== DEFAULT_RADIUS,
    },
    {
      key: "name",
      label: filterText ? `Name • ${filterText}` : "Name",
      isActive: Boolean(filterText),
    },
    ...dynamicFilterPills,
  ];

  const parseHourlyRateValue = useCallback((coach) => {
    if (!coach?.hourlyRate) return null;
    const match = coach.hourlyRate.match(/[\d,.]+/);
    if (!match) return null;
    const numeric = Number(match[0].replace(/,/g, ""));
    return Number.isFinite(numeric) ? numeric : null;
  }, []);

  const sortedAllCoaches = useMemo(() => {
    const items = [...allCoachPlayers];
    if (sortOption === "name") {
      return items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    if (sortOption === "rateHigh" || sortOption === "rateLow") {
      return items.sort((a, b) => {
        const aRate = parseHourlyRateValue(a) ?? (sortOption === "rateLow" ? Infinity : -Infinity);
        const bRate = parseHourlyRateValue(b) ?? (sortOption === "rateLow" ? Infinity : -Infinity);
        return sortOption === "rateHigh" ? bRate - aRate : aRate - bRate;
      });
    }
    return items;
  }, [allCoachPlayers, parseHourlyRateValue, sortOption]);

  const featuredCoaches = useMemo(() => {
    if (addedCoachPlayers.length) {
      return addedCoachPlayers.slice(0, 2);
    }
    return sortedAllCoaches.slice(0, 2);
  }, [addedCoachPlayers, sortedAllCoaches]);

  const featuredIdentifiers = useMemo(() => {
    return new Set(
      featuredCoaches.map(
        (coach, index) => coach?.id ?? coach?.slug ?? coach?.name ?? index,
      ),
    );
  }, [featuredCoaches]);

  const remainingCoaches = useMemo(() => {
    if (!featuredCoaches.length) return sortedAllCoaches;
    return sortedAllCoaches.filter((coach, index) => {
      const identifier = coach?.id ?? coach?.slug ?? coach?.name ?? index;
      if (!featuredIdentifiers.size) {
        return index >= featuredCoaches.length;
      }
      return !featuredIdentifiers.has(identifier);
    });
  }, [featuredCoaches, featuredIdentifiers, sortedAllCoaches]);

  const coachesFound = sortedAllCoaches.length;

  const highlightStats = useMemo(
    () => [
      {
        icon: MapPin,
        label: "Coaches Nearby",
        value: canQueryAllCoaches ? coachesFound : 0,
      },
      {
        icon: Star,
        label: "Average Rating",
        value: "4.8",
      },
      {
        icon: Users,
        label: "Players Matched",
        value: "500+",
      },
      {
        icon: Target,
        label: "Specialties",
        value: dynamicFilters.length ? `${dynamicFilters.length}` : "7",
      },
    ],
    [canQueryAllCoaches, coachesFound, dynamicFilters.length],
  );

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
    <div className="coach-discover-page">
      <header className="coach-discover-hero">
        <div className="coach-discover-hero__copy">
          <p className="coach-discover-eyebrow">Matchplay Discover</p>
          <h1>Find Your Perfect Coach</h1>
          <p className="coach-discover-description">
            Get matched with certified tennis professionals in your area and start
            improving your game today.
          </p>
          <div className="coach-discover-location">
            <button
              type="button"
              className="coach-discover-location__chip"
              onClick={() => setOpenFilter("location")}
            >
              <MapPin size={16} />
              <span>{locationFilter?.address || "Add location"}</span>
            </button>
            <span className="coach-discover-location__radius">Within {radius} miles</span>
          </div>
        </div>
        <aside className="coach-discover-stats">
          {highlightStats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="coach-discover-stat-card">
              <div className="coach-discover-stat-icon">
                <Icon size={18} />
              </div>
              <div className="coach-discover-stat-copy">
                <span className="coach-discover-stat-value">{value}</span>
                <span className="coach-discover-stat-label">{label}</span>
              </div>
            </div>
          ))}
        </aside>
      </header>

      <div className="coach-discover-toolbar">
        <div className="coach-discover-pills">
          {pills.map((pill) => (
            <button
              type="button"
              key={pill.key}
              className={`coach-filter-pill${pill.isActive ? " coach-filter-pill--active" : ""}`}
              onClick={() => setOpenFilter(pill.key)}
            >
              {pill.label}
            </button>
          ))}
        </div>
        <div className="coach-discover-actions">
          <div className="coach-sort">
            <label htmlFor="coach-sort-select">Sort by</label>
            <select
              id="coach-sort-select"
              value={sortOption}
              onChange={(event) => setSortOption(event.target.value)}
            >
              <option value="recommended">Recommended</option>
              <option value="rateLow">Price: Low to High</option>
              <option value="rateHigh">Price: High to Low</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
          <button
            type="button"
            className={`coach-refresh${refreshing ? " coach-refresh--loading" : ""}`}
            onClick={handleRefresh}
          >
            <RefreshCcw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {shouldShowLocationPrompt ? (
        <div className="coach-location-banner">
          <div className="coach-location-banner__copy">
            <h2>Enable location to find nearby coaches</h2>
            <p>
              Turn on your device location or pick a location to see coaches close to
              you.
            </p>
            {locationError ? <p className="coach-location-banner__error">{locationError}</p> : null}
          </div>
          <div className="coach-location-banner__actions">
            <button type="button" className="primary" onClick={requestLocation}>
              {locationLoader ? <Loader2 className="spin" size={16} /> : null}
              Enable Location
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setOpenFilter("location")}
            >
              Enter Manually
            </button>
          </div>
        </div>
      ) : null}

      <section className="coach-discover-results">
        <div className="coach-discover-results__meta">
          <span className="coach-discover-results__count">{coachesFound} coaches found</span>
        </div>

        {allMiniLoader && !sortedAllCoaches.length ? (
          <div className="coach-discover-loader">
            <Loader2 className="spin" size={32} />
            <p>Loading coaches…</p>
          </div>
        ) : null}

        {!allMiniLoader && !sortedAllCoaches.length ? (
          <div className="coach-discover-empty">No coaches found.</div>
        ) : null}

        {featuredCoaches.length ? (
          <div className="coach-featured-section">
            <div className="coach-section-heading">
              <h2>Featured Coaches</h2>
              <p>Handpicked pros with top reviews and specialties.</p>
            </div>
            <div className="coach-featured-grid">
              {featuredCoaches.map((coach) => (
                <CoachCard key={coach.id || coach.slug || coach.name} coach={coach} variant="featured" />
              ))}
            </div>
          </div>
        ) : null}

        {remainingCoaches.length ? (
          <div className="coach-all-section">
            <div className="coach-section-heading">
              <h2>All Coaches</h2>
              <p>Browse every certified Matchplay coach near you.</p>
            </div>
            <div className="coach-grid">
              {remainingCoaches.map((coach) => (
                <CoachCard
                  key={`coach-${coach.id || coach.slug || coach.name}`}
                  coach={coach}
                />
              ))}
            </div>
          </div>
        ) : null}
        <div ref={allListSentinelRef} className="coach-discover-sentinel" aria-hidden>
          {allMiniLoader && sortedAllCoaches.length ? <Loader2 className="spin" size={20} /> : null}
          {isAllCoachesListEnd && sortedAllCoaches.length ? <span>End of results</span> : null}
        </div>
      </section>

      <FilterModal
        title="Location"
        isOpen={openFilter === "location"}
        onClose={() => setOpenFilter(null)}
        onClearAll={handleClearFilter}
        onDone={() => setOpenFilter(null)}
      >
        <div className="location-filter">
          <label className="field-label" htmlFor="coach-location-search">
            Search address
          </label>
          <div className="field-with-icon">
            <Search size={16} />
            <input
              id="coach-location-search"
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
              <Loader2 className="spin" size={16} /> Searching…
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
                    <MapPin size={16} />
                    <span>{suggestion.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="location-preview">
            <h3>Selected location</h3>
            {locationPreview?.latitude && locationPreview?.longitude ? (
              <p>
                Lat {locationPreview.latitude.toFixed(4)}, Lng {" "}
                {locationPreview.longitude.toFixed(4)}
              </p>
            ) : (
              <p>No location selected yet.</p>
            )}
          </div>
        </div>
      </FilterModal>

      <FilterModal
        title="Radius"
        isOpen={openFilter === "radius"}
        onClose={() => setOpenFilter(null)}
        onClearAll={handleClearFilter}
        onDone={() => setOpenFilter(null)}
      >
        <div className="radius-filter">
          <div className="radius-value">
            <span>{radius} miles</span>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            value={radius}
            onChange={(event) => handleRadiusChange(Number(event.target.value))}
            onMouseUp={(event) => handleRadiusChange(Number(event.target.value))}
            onTouchEnd={(event) => handleRadiusChange(Number(event.target.value))}
          />
          <p className="radius-hint">Adjust the search radius to expand or narrow results.</p>
        </div>
      </FilterModal>

      <FilterModal
        title="Name"
        isOpen={openFilter === "name"}
        onClose={() => setOpenFilter(null)}
        onClearAll={handleClearFilter}
        onDone={handleNameApply}
      >
        <div className="name-filter">
          <label className="field-label" htmlFor="coach-name-filter">
            Coach name
          </label>
          <input
            id="coach-name-filter"
            type="text"
            value={nameDraft}
            placeholder="Search by coach name"
            onChange={(event) => setNameDraft(event.target.value)}
          />
          <button type="button" className="apply-button" onClick={handleNameApply}>
            Apply
          </button>
        </div>
      </FilterModal>

      {dynamicFilters.map((filter) => (
        <FilterModal
          key={filter.key}
          title={filter.title}
          isOpen={openFilter === filter.key}
          onClose={() => setOpenFilter(null)}
          onClearAll={handleClearFilter}
          onDone={() => setOpenFilter(null)}
        >
          {filter.options?.length ? (
            renderDynamicFilterControls(filter)
          ) : (
            <p className="filter-empty">No options available.</p>
          )}
        </FilterModal>
      ))}
    </div>
  );
};

export default PlayerCoachListPage;
