/// <reference types="google.maps" />

import Autocomplete from "react-google-autocomplete";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  MapPin,
  Search,
  SlidersHorizontal,
  Star,
} from "lucide-react";

import MainLayout from "../components/MainLayout";
import { fetchCoachProfile } from "../api/coachProfile";
import { mockCoaches, type Coach, type CoachHighlight } from "../data/mockCoaches";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { getStoredAuthToken } from "../services/authToken";
import {
  DEFAULT_POSITION,
  storeLocation,
  storeLocationLabel,
  type Coordinates,
} from "../utils/userLocation";

import "./FindCoachesPage.css";

type Mode = "normal" | "empty" | "error";
type Status = "loading" | "ready";

type SelectedLocation = {
  label: string;
  latitude: number;
  longitude: number;
  isCurrentLocation?: boolean;
};

type FilterGroupKey = "levels" | "formats" | "availability";

type CoachCardModel = Coach & {
  initials: string;
  verified: boolean;
  studentCount: number | null;
  distanceMiles: number | null;
  cityLabel: string;
  hourlyRateValue: number | null;
  groupRateValue: number | null;
  availabilityWindows: string[];
  formats: string[];
};

const radiusOptions = ["5 mi", "10 mi", "15 mi", "20 mi", "All"];
const availabilityOptions = ["Weekday Mornings", "Weekday Afternoons", "Weekday Evenings", "Weekends"];

const parseRadius = (radius: string) => {
  const match = radius.match(/(\d+)/);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
};

const toStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (entry === null || entry === undefined) return "";
        if (typeof entry === "string") return entry.trim();
        if (typeof entry === "number" || typeof entry === "boolean") return String(entry);
        const record = entry as Record<string, unknown>;
        const label = record.label ?? record.name ?? record.title ?? record.value ?? "";
        return typeof label === "string" ? label.trim() : String(label ?? "");
      })
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/,|\n|\|/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  return [];
};

const pickFirstString = (...values: Array<unknown>): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") {
      const next = String(value).trim();
      if (next) return next;
    }
  }
  return "";
};

const parseNumberValue = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const extractCoachArray = (payload: unknown): Record<string, unknown>[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const container = payload as Record<string, unknown>;
  const candidates = [container.data, container.results, container.coaches, container.items];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as Record<string, unknown>[];
  }
  return [];
};

const pickImageUrl = (record: Record<string, unknown>): string => {
  const candidates = [
    record.avatar,
    record.avatar_url,
    record.profile_image,
    record.profile_picture,
    record.photo,
    record.image,
    record.picture,
    (record.media as Record<string, unknown> | undefined)?.profile_image,
    (record.profile as Record<string, unknown> | undefined)?.profile_image,
    (record.user as Record<string, unknown> | undefined)?.profile_image,
    ((record.user as Record<string, unknown> | undefined)?.profile as Record<string, unknown> | undefined)?.profile_image,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim() && !candidate.trim().endsWith(".com/")) {
      return candidate.trim();
    }
  }
  return (
    mockCoaches[0]?.imageUrl ??
    "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=256&q=80"
  );
};

const buildInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "TC";

const deriveFormats = (record: Record<string, unknown>) => {
  const pricing = (record.pricing as Record<string, unknown> | undefined) ?? {};
  const formats = toStringArray(record.formats ?? record.lesson_formats ?? record.lesson_types);
  if (formats.length > 0) return formats;
  const result = ["Private"];
  if (
    parseNumberValue(record.group_rate) !== null ||
    pickFirstString(record.group_rate) ||
    parseNumberValue(pricing.group ?? pricing.group_price) !== null
  ) {
    result.push("Group");
  }
  return result;
};

const deriveAvailabilityWindows = (record: Record<string, unknown>) => {
  const explicit = toStringArray(
    record.availability_windows ?? record.availability_labels ?? record.available_times ?? record.availability,
  );
  if (explicit.length > 0) return explicit;
  return ["Weekday Mornings", "Weekends"];
};

const parseStudentCountFromHighlights = (highlights: Array<Record<string, unknown>>) => {
  for (const highlight of highlights) {
    const label = pickFirstString(highlight.label);
    const match = label.match(/(\d+)/);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

const mergeCoachProfileIntoCard = (coach: CoachCardModel, profile: Record<string, unknown>): CoachCardModel => {
  const booking = (profile.booking as Record<string, unknown> | undefined) ?? {};
  const bookingDates = Array.isArray(booking.availableDates)
    ? (booking.availableDates as Array<Record<string, unknown>>)
    : [];
  const lessonTypes = Array.isArray(booking.lessonTypes)
    ? (booking.lessonTypes as Array<Record<string, unknown>>)
    : [];
  const highlightChips = Array.isArray(profile.highlightChips)
    ? (profile.highlightChips as Array<Record<string, unknown>>)
    : [];
  const metrics = Array.isArray(profile.metrics)
    ? (profile.metrics as Array<Record<string, unknown>>)
    : [];
  const coachingLocations = toStringArray(profile.coachingLocations);
  const profileLocations = Array.isArray(profile.locations)
    ? (profile.locations as Array<Record<string, unknown>>).map((location) => pickFirstString(location.label))
    : [];
  const availabilityWindows =
    bookingDates.length > 0
      ? bookingDates.map((date) => {
          const label = pickFirstString(date.label);
          const totalSlots = parseNumberValue(date.totalSlots);
          return totalSlots && totalSlots > 0 ? `${label} (${totalSlots} slot${totalSlots === 1 ? "" : "s"})` : label;
        }).filter(Boolean)
      : toStringArray(profile.availability);

  const lessonTypeLabels = lessonTypes.map((lessonType) => pickFirstString(lessonType.label)).filter(Boolean);
  const privateMetric = metrics.find((metric) => pickFirstString(metric.label).toLowerCase() === "private");
  const privateValue = pickFirstString(privateMetric?.value);
  const groupLessonType = lessonTypes.find((lessonType) => pickFirstString(lessonType.id).toLowerCase() === "group");
  const groupValue = pickFirstString(groupLessonType?.price);
  const studentCount =
    parseNumberValue(profile.studentCount ?? profile.student_count) ?? parseStudentCountFromHighlights(highlightChips);

  return {
    ...coach,
    name: pickFirstString(profile.fullName, coach.name) || coach.name,
    initials: pickFirstString(profile.initials) || coach.initials,
    bio: pickFirstString(profile.about, coach.bio) || coach.bio,
    summary: pickFirstString(profile.about, coach.summary) || coach.summary,
    yearsExperience: parseNumberValue(profile.experienceYears ?? profile.experience_years) ?? coach.yearsExperience,
    certifications: toStringArray(profile.certifications),
    specialties: toStringArray(profile.specialties),
    courts: coachingLocations.length > 0 ? coachingLocations : profileLocations.length > 0 ? profileLocations : coach.courts,
    levels: toStringArray(profile.levels),
    formats: lessonTypeLabels.length > 0 ? lessonTypeLabels.map((label) => label.replace(/\s+lesson$/i, "")) : coach.formats,
    languages: toStringArray(profile.languages),
    availability: availabilityWindows[0] || coach.availability,
    availabilityWindows: availabilityWindows.length > 0 ? availabilityWindows : coach.availabilityWindows,
    lessonRates: {
      private: privateValue || coach.lessonRates.private,
      group: groupValue || coach.lessonRates.group,
    },
    hourlyRateValue:
      parseNumberValue(privateValue.replace?.(/[^\d.]/g, "")) ?? coach.hourlyRateValue,
    groupRateValue:
      parseNumberValue(groupValue.replace?.(/[^\d.]/g, "")) ?? coach.groupRateValue,
    pricePerHour: `${privateValue || coach.lessonRates.private}/hr`,
    imageUrl: pickImageUrl({ ...coach, profilePicture: profile.profilePicture }),
    cityLabel: coachingLocations[0] || profileLocations[0] || coach.cityLabel,
    location: coachingLocations[0] || profileLocations[0] || coach.location,
    studentCount: studentCount ?? coach.studentCount,
    tags:
      toStringArray(profile.specialties).length > 0
        ? toStringArray(profile.specialties).slice(0, 3)
        : coach.tags,
  };
};

const mapCoachRecordToCard = (record: Record<string, unknown>, fallbackIndex: number): CoachCardModel => {
  const pricing = (record.pricing as Record<string, unknown> | undefined) ?? {};
  const primaryLocation = (record.primary_location as Record<string, unknown> | undefined) ?? undefined;
  const locationRecords = Array.isArray(record.locations)
    ? (record.locations as Array<Record<string, unknown>>)
    : [];
  const idCandidate =
    record.id ?? record.coach_id ?? record.player_coach_id ?? record.user_id ?? record.uuid ?? `${fallbackIndex}`;
  const displayName =
    pickFirstString(record.full_name, record.fullName, record.name, record.coach_name, record.coachName) ||
    `Coach ${fallbackIndex + 1}`;
  const certifications = toStringArray(record.certifications ?? record.certification ?? []);
  const locations = locationRecords
    .map((location) => pickFirstString(location.label, location.name, location.title))
    .filter(Boolean);
  const cityLabel =
    pickFirstString(
      primaryLocation?.label,
      record.city_label,
      record.location,
      record.city,
      record.city_name,
      record.facility,
      record.club_name,
    ) || locations[0] || "Multiple locations";
  const hourlyRate = parseNumberValue(
    record.hourly_rate ?? pricing.hourly ?? pricing.private ?? record.price_per_hour ?? record.hourlyRate ?? record.rate,
  );
  const hourlyRateDisplay =
    hourlyRate !== null ? `$${hourlyRate.toFixed(0)}` : "$0";
  const groupRateValue = parseNumberValue(record.group_rate ?? pricing.group ?? pricing.group_price ?? record.price_group);
  const groupRateDisplay =
    groupRateValue !== null ? `$${groupRateValue.toFixed(0)}` : "";
  const summary =
    pickFirstString(
      record.about_me,
      record.summary,
      record.bio,
      record.about,
      record.description,
      (record.profile as Record<string, unknown> | undefined)?.summary,
      (record.profile as Record<string, unknown> | undefined)?.bio,
    ) || "Tennis coach profile coming soon.";
  const experience =
    parseNumberValue(
      record.years_experience ?? record.experience_years ?? record.yearsExperience ?? record.experience,
    ) ?? 0;
  const courts = locations.length > 0 ? locations : toStringArray(record.courts ?? record.venues ?? []);
  const levels = toStringArray(record.levels ?? record.focus_levels ?? record.skill_levels ?? []);
  const specialties = toStringArray(
    record.specialties ?? record.speciality ?? record.specialty ?? record.tags ?? [],
  );
  const languages = toStringArray(record.languages ?? record.language ?? []);
  const availabilityWindows = deriveAvailabilityWindows(record);
  const availabilitySummary = availabilityWindows[0] || "Availability on request";
  const nextLessonDay = availabilityWindows[0] || "Availability";
  const nextLessonTime = availabilityWindows[1] || "";
  const nextLessonCourt = cityLabel;
  const ratingValue =
    parseNumberValue(record.review_score ?? record.rating ?? record.rating_value ?? record.score) ?? 0;
  const ratingCount =
    parseNumberValue(
      record.review_count ?? record.reviews_count ?? record.rating_count ?? record.total_reviews,
    ) ?? 0;
  const distanceMiles = parseNumberValue(
    record.distance_miles ??
      record.distanceMiles ??
      record.distance ??
      primaryLocation?.distanceMiles,
  );
  const formats = deriveFormats(record);
  const highlightCandidates: CoachHighlight[] = [];
  if (cityLabel) highlightCandidates.push({ icon: "map", label: cityLabel });
  highlightCandidates.push({ icon: "calendar", label: availabilitySummary });
  if (specialties.length > 0) highlightCandidates.push({ icon: "spark", label: specialties[0] });
  else if (formats.length > 0) highlightCandidates.push({ icon: "users", label: formats.join(" · ") });

  const numericId = (() => {
    if (typeof idCandidate === "number" && Number.isFinite(idCandidate)) return idCandidate;
    const parsed = Number(idCandidate);
    if (Number.isFinite(parsed)) return parsed;
    return fallbackIndex + 1;
  })();

  return {
    id: numericId,
    name: displayName,
    initials: pickFirstString(record.initials) || buildInitials(displayName),
    title:
      pickFirstString(record.title, record.headline, certifications[0], record.speciality, record.specialty, record.role, "Tennis Coach") ||
      "Tennis Professional",
    rating: ratingValue,
    reviewCount: ratingCount,
    studentCount: parseNumberValue(record.student_count ?? record.studentCount),
    location: cityLabel,
    pricePerHour: `${hourlyRateDisplay}/hr`,
    availabilityTag: availabilitySummary,
    featured: Boolean(record.is_featured || record.featured),
    summary,
    bio: summary,
    yearsExperience: experience,
    certifications,
    courts: courts.length > 0 ? courts : [cityLabel],
    levels: levels.length > 0 ? levels : ["Beginner", "Intermediate"],
    specialties,
    lessonRates: {
      private: hourlyRateDisplay,
      group: groupRateDisplay || hourlyRateDisplay,
    },
    languages,
    availability: availabilitySummary,
    nextAvailableLesson: {
      day: nextLessonDay,
      time: nextLessonTime,
      court: nextLessonCourt,
    },
    highlights: highlightCandidates,
    tags: specialties.length > 0 ? specialties.slice(0, 3) : formats.slice(0, 1),
    imageUrl: pickImageUrl(record),
    verified: certifications.length > 0,
    distanceMiles,
    cityLabel,
    hourlyRateValue: hourlyRate,
    groupRateValue,
    availabilityWindows,
    formats,
  };
};

const FindCoaches = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [selectedRadius, setSelectedRadius] = useState<string>(radiusOptions[1]);
  const [appliedRadius, setAppliedRadius] = useState<string>(radiusOptions[1]);
  const [sortBy, setSortBy] = useState("distance");
  const [mode, setMode] = useState<Mode>("normal");
  const [status, setStatus] = useState<Status>("loading");
  const [coaches, setCoaches] = useState<CoachCardModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [storedToken] = useState(() =>
    getStoredAuthToken({ defaultScheme: "token", preferScheme: "token" }) ?? undefined,
  );
  const playerToken = user?.session?.access_token ?? user?.access_token ?? user?.token ?? storedToken ?? null;
  const [position, setPosition] = useState<Coordinates | null>(DEFAULT_POSITION);
  const [locationFilter, setLocationFilter] = useState<SelectedLocation | null>(null);
  const [locationSearchTerm, setLocationSearchTerm] = useState(locationFilter?.label ?? "");
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<FilterGroupKey, string[]>>({
    levels: [],
    formats: [],
    availability: [],
  });

  const locationLabel = locationFilter?.label ?? (position ? "Current location" : "Select location");
  const hasLocationFilter = Boolean(locationFilter);

  const applyLocationFilter = useCallback((nextLocation: SelectedLocation | null) => {
    if (nextLocation && typeof nextLocation.latitude === "number" && typeof nextLocation.longitude === "number") {
      const coords: Coordinates = {
        latitude: nextLocation.latitude,
        longitude: nextLocation.longitude,
      };
      setPosition(coords);
      storeLocation(coords);
      storeLocationLabel(nextLocation.label);
      setLocationFilter(nextLocation);
      setLocationSearchTerm(nextLocation.label);
      setGeoError("");
      setShowLocationPicker(false);
      setMode("normal");
      return;
    }

    setLocationFilter(null);
    setLocationSearchTerm("");
    setGeoError("");
    setShowLocationPicker(false);
    setMode("normal");
    setPosition({ ...DEFAULT_POSITION });
    storeLocation(null);
    storeLocationLabel(null);
  }, []);

  const detectCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Location detection is not supported in this browser.");
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (nextPosition) => {
        setIsDetectingLocation(false);
        applyLocationFilter({
          label: "Current location",
          latitude: nextPosition.coords.latitude,
          longitude: nextPosition.coords.longitude,
          isCurrentLocation: true,
        });
      },
      (nextError) => {
        setIsDetectingLocation(false);
        setGeoError(nextError.message || "We couldn't detect your location. Please allow access and try again.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }, [applyLocationFilter]);

  const closeLocationPicker = useCallback(() => {
    setShowLocationPicker(false);
    setGeoError("");
    setLocationSearchTerm(locationFilter?.label ?? "");
  }, [locationFilter?.label]);

  useEffect(() => {
    setLocationSearchTerm(locationFilter?.label ?? "");
  }, [locationFilter?.label]);

  const fetchCoaches = useCallback(async () => {
    if (!playerToken) {
      setCoaches([]);
      setStatus("ready");
      setMode("error");
      setError("Please sign in to search for coaches.");
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      const radiusValue = parseRadius(appliedRadius);
      const searchValue = appliedSearchTerm.trim();
      const params = new URLSearchParams({
        perPage: "12",
        page: "1",
        search: searchValue,
      });
      if (typeof radiusValue === "number") params.set("radius", radiusValue.toString());

      const positionPayload =
        position && typeof position.latitude === "number" && typeof position.longitude === "number"
          ? {
              latitude: position.latitude,
              longitude: position.longitude,
              latitudeDelta: 0.25,
              longitudeDelta: 0.25,
            }
          : null;

      // When a place is chosen from Google autocomplete, use its coordinates for lookup
      // instead of sending the human-readable place label in the query string.
      if (!positionPayload) {
        const locationSearchValue = locationSearchTerm.trim();
        if (locationSearchValue) params.set("locationSearch", locationSearchValue);
      }

      const response = await api(`player/getchecklocation?${params.toString()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
        },
        json: {
          position: positionPayload,
        },
        authToken: playerToken,
      });

      if (response.status === 404) {
        setCoaches([]);
        setMode("empty");
        setStatus("ready");
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to load coaches (${response.status})`);
      }

      const payload = await response.json();
      const baseCards = extractCoachArray(payload).map((coach, index) => mapCoachRecordToCard(coach, index));
      const normalized = await Promise.all(
        baseCards.map(async (coach) => {
          try {
            const profile = await fetchCoachProfile(coach.id);
            return mergeCoachProfileIntoCard(coach, profile as Record<string, unknown>);
          } catch {
            return coach;
          }
        }),
      );
      setCoaches(normalized);
      setMode(normalized.length > 0 ? "normal" : "empty");
    } catch (requestError) {
      setCoaches([]);
      setMode("error");
      setError(
        requestError instanceof Error ? requestError.message : "We couldn't load coaches right now.",
      );
    } finally {
      setStatus("ready");
    }
  }, [
    appliedRadius,
    appliedSearchTerm,
    playerToken,
    locationSearchTerm,
    position?.latitude,
    position?.longitude,
  ]);

  useEffect(() => {
    fetchCoaches();
  }, [fetchCoaches]);

  const handleSearch = () => {
    const trimmed = searchTerm.trim();
    setMode("normal");
    if (trimmed === appliedSearchTerm) {
      fetchCoaches();
      return;
    }
    setAppliedSearchTerm(trimmed);
  };

  const handleRadiusChange = (radius: string) => {
    setSelectedRadius(radius);
    setMode("normal");
    if (radius === appliedRadius) {
      fetchCoaches();
      return;
    }
    setAppliedRadius(radius);
  };

  const toggleFilter = (key: FilterGroupKey, value: string) => {
    setActiveFilters((prev) => {
      const current = prev[key];
      return {
        ...prev,
        [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
      };
    });
  };

  const resetFilters = () => {
    setSearchTerm("");
    setAppliedSearchTerm("");
    setSelectedRadius(radiusOptions[1]);
    setAppliedRadius(radiusOptions[1]);
    setActiveFilters({ levels: [], formats: [], availability: [] });
    applyLocationFilter(null);
  };

  const levelOptions = useMemo(
    () => Array.from(new Set(coaches.flatMap((coach) => coach.levels))).slice(0, 6),
    [coaches],
  );

  const formatOptions = useMemo(
    () => Array.from(new Set(coaches.flatMap((coach) => coach.formats))),
    [coaches],
  );

  const visibleAvailabilityOptions = useMemo(
    () =>
      availabilityOptions.filter((option) =>
        coaches.some((coach) => coach.availabilityWindows.includes(option)),
      ),
    [coaches],
  );

  const filteredCoaches = useMemo(() => {
    if (mode !== "normal") return [];

    const next = coaches
      .filter((coach) => {
        if (activeFilters.levels.length > 0 && !activeFilters.levels.some((level) => coach.levels.includes(level))) {
          return false;
        }
        if (activeFilters.formats.length > 0 && !activeFilters.formats.some((format) => coach.formats.includes(format))) {
          return false;
        }
        if (
          activeFilters.availability.length > 0 &&
          !activeFilters.availability.some((availability) => coach.availabilityWindows.includes(availability))
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "rating") return b.rating - a.rating;
        if (sortBy === "price_asc") return (a.hourlyRateValue ?? Number.MAX_SAFE_INTEGER) - (b.hourlyRateValue ?? Number.MAX_SAFE_INTEGER);
        if (sortBy === "price_desc") return (b.hourlyRateValue ?? 0) - (a.hourlyRateValue ?? 0);
        return (a.distanceMiles ?? Number.MAX_SAFE_INTEGER) - (b.distanceMiles ?? Number.MAX_SAFE_INTEGER);
      });

    return next;
  }, [activeFilters, coaches, mode, sortBy]);

  const activeFilterCount = Object.values(activeFilters).flat().length;
  const shouldShowError = status === "ready" && mode === "error";
  const shouldShowEmpty =
    status === "ready" && (mode === "empty" || (mode === "normal" && filteredCoaches.length === 0));
  const shouldShowResults = status === "ready" && mode === "normal" && filteredCoaches.length > 0;

  const locationShortLabel = hasLocationFilter ? locationLabel : "Nearby";
  const resultsCountLabel =
    status === "loading"
      ? "Finding coaches..."
      : shouldShowError
        ? "Unable to load coaches"
        : shouldShowEmpty
          ? "No coaches found"
          : `${filteredCoaches.length} ${filteredCoaches.length === 1 ? "coach" : "coaches"} near you`;

  const renderLocationPickerPanel = () => (
    <section className="fcv2-location-panel" id="coach-location-picker" aria-label="Location picker">
      <div className="fcv2-location-panel-head">
        <div>
          <p className="fcv2-location-label">Location search</p>
          <h2>Choose where to search</h2>
        </div>
        <button type="button" onClick={closeLocationPicker}>
          Close
        </button>
      </div>

      <div className="fcv2-location-search">
        <Search size={16} />
        <Autocomplete
          apiKey={import.meta.env.VITE_GOOGLE_API_KEY || undefined}
          placeholder="City, neighborhood, club, or court"
          className="fcv2-location-input"
          value={locationSearchTerm}
          onChange={(event) => setLocationSearchTerm(event.target.value)}
          onPlaceSelected={(place: google.maps.places.PlaceResult | null) => {
            if (!place) {
              setGeoError("Please choose a location from the suggestions.");
              return;
            }

            const latitude = place.geometry?.location?.lat?.();
            const longitude = place.geometry?.location?.lng?.();
            const label = place.formatted_address || place.name || locationSearchTerm || "Custom location";

            if (
              typeof latitude === "number" &&
              !Number.isNaN(latitude) &&
              typeof longitude === "number" &&
              !Number.isNaN(longitude)
            ) {
              applyLocationFilter({ label, latitude, longitude });
            } else {
              setGeoError("We couldn't read that location's coordinates. Try another search.");
            }
          }}
          options={{
            types: ["geocode", "establishment"],
            fields: ["formatted_address", "geometry", "name", "address_components"],
          }}
        />
      </div>

      <div className="fcv2-location-actions">
        <button
          type="button"
          className="fcv2-location-detect"
          onClick={detectCurrentLocation}
          disabled={isDetectingLocation}
        >
          {isDetectingLocation ? "Detecting location..." : "Use my current location"}
        </button>
        {hasLocationFilter ? (
          <button type="button" className="fcv2-location-clear" onClick={() => applyLocationFilter(null)}>
            Clear location
          </button>
        ) : null}
      </div>

      <div className="fcv2-location-summary">
        <strong>Selected location</strong>
        <p>
          {locationFilter
            ? locationFilter.label
            : position
              ? `Lat ${position.latitude.toFixed(4)}, Lng ${position.longitude.toFixed(4)}`
              : "No location selected yet."}
        </p>
      </div>

      {geoError ? <p className="fcv2-location-error">{geoError}</p> : null}
      {!import.meta.env.VITE_GOOGLE_API_KEY ? (
        <p className="fcv2-location-tip">
          Add `VITE_GOOGLE_API_KEY` to enable Google Places suggestions.
        </p>
      ) : null}
    </section>
  );

  return (
    <MainLayout>
      <div className="fcv2-page">
        <header className="fcv2-mobile-header">
          <div className="fcv2-mobile-brand">
            <span className="fcv2-mobile-brand-mark">🎾</span>
            <span>
              The Tennis <em>Plan</em>
            </span>
          </div>

          <button
            type="button"
            className="fcv2-mobile-location"
            onClick={() => {
              setGeoError("");
              setLocationSearchTerm(locationFilter?.label ?? "");
              setShowLocationPicker(true);
            }}
          >
            <MapPin size={14} />
            <span>{locationLabel}</span>
            <ChevronDown size={14} />
          </button>
        </header>

        <section className="fcv2-mobile-search-block">
          <div className="fcv2-mobile-title-row">
            <div>
              <h1>Find a Coach</h1>
              <p>{resultsCountLabel}</p>
            </div>

            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="fcv2-mobile-sort">
              <option value="distance">Nearest</option>
              <option value="rating">Top Rated</option>
              <option value="price_asc">Price ↑</option>
              <option value="price_desc">Price ↓</option>
            </select>
          </div>

          <div className="fcv2-mobile-search-row">
            <div className="fcv2-mobile-search-input">
              <Search size={16} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSearch();
                }}
                placeholder="Search by name, specialty, court..."
                aria-label="Search coaches"
              />
            </div>

            <button
              type="button"
              className="fcv2-mobile-filter-button"
              onClick={() => setShowFiltersSheet(true)}
            >
              <SlidersHorizontal size={15} />
              <span>{activeFilterCount > 0 ? activeFilterCount : "Filter"}</span>
            </button>
          </div>
        </section>

        <div className="fcv2-shell">
          <section className="fcv2-page-head">
            <div className="fcv2-page-head-copy">
              <h1>Find a Coach</h1>
              <p>
                <span>📍 {locationShortLabel}</span>
                <span>·</span>
                <span>{resultsCountLabel}</span>
              </p>
            </div>

            <div className="fcv2-page-head-actions">
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="fcv2-sort-select"
                aria-label="Sort coaches"
              >
                <option value="distance">Nearest first</option>
                <option value="rating">Top rated</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </section>

          <section className="fcv2-search-panel">
            <div className="fcv2-search-bar">
              <Search size={18} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSearch();
                }}
                placeholder="Search by coach name, court, or specialty"
                aria-label="Search coaches"
              />
              <button type="button" onClick={handleSearch}>
                Search
              </button>
            </div>

            <div className="fcv2-toolbar">
              <button
                type="button"
                className={`fcv2-location-button${showLocationPicker ? " is-open" : ""}`}
                onClick={() => {
                  setGeoError("");
                  setLocationSearchTerm(locationFilter?.label ?? "");
                  setShowLocationPicker((prev) => !prev);
                }}
              >
                <MapPin size={16} />
                <span>{locationLabel}</span>
                <ChevronDown size={16} />
              </button>

              <button
                type="button"
                className="fcv2-filter-summary"
                onClick={detectCurrentLocation}
                disabled={isDetectingLocation}
              >
                <MapPin size={15} />
                <span>{isDetectingLocation ? "Detecting..." : "Use current location"}</span>
              </button>

              <div className="fcv2-radius-group" aria-label="Distance filter">
                {radiusOptions.map((radius) => (
                  <button
                    key={radius}
                    type="button"
                    className={selectedRadius === radius ? "active" : ""}
                    onClick={() => handleRadiusChange(radius)}
                  >
                    {radius}
                  </button>
                ))}
              </div>
            </div>

            {showLocationPicker ? renderLocationPickerPanel() : null}

            <div className="fcv2-chip-sections">
              {levelOptions.length > 0 ? (
                <div className="fcv2-chip-row">
                  <span>Level</span>
                  {levelOptions.map((level) => (
                    <button
                      key={level}
                      type="button"
                      className={activeFilters.levels.includes(level) ? "active" : ""}
                      onClick={() => toggleFilter("levels", level)}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              ) : null}

              {formatOptions.length > 0 ? (
                <div className="fcv2-chip-row">
                  <span>Format</span>
                  {formatOptions.map((format) => (
                    <button
                      key={format}
                      type="button"
                      className={activeFilters.formats.includes(format) ? "active" : ""}
                      onClick={() => toggleFilter("formats", format)}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              ) : null}

              {visibleAvailabilityOptions.length > 0 || activeFilterCount > 0 ? (
                <div className="fcv2-chip-row">
                  <span>When</span>
                  {visibleAvailabilityOptions.map((availability) => (
                    <button
                      key={availability}
                      type="button"
                      className={activeFilters.availability.includes(availability) ? "active" : ""}
                      onClick={() => toggleFilter("availability", availability)}
                    >
                      {availability.replace("Weekday ", "")}
                    </button>
                  ))}

                  {activeFilterCount > 0 ? (
                    <button type="button" className="fcv2-clear-chip" onClick={() => setActiveFilters({ levels: [], formats: [], availability: [] })}>
                      Clear {activeFilterCount}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <button type="button" className="fcv2-mobile-filter-button fcv2-desktop-filter-button" onClick={() => setShowFiltersSheet(true)}>
              <SlidersHorizontal size={15} />
              <span>{activeFilterCount > 0 ? `${activeFilterCount} filters active` : "More filters"}</span>
            </button>
          </section>

          {status === "loading" ? (
            <section className="fcv2-grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <article key={index} className="fcv2-card fcv2-card-skeleton" aria-hidden="true">
                  <div className="fcv2-skeleton fcv2-skeleton-avatar" />
                  <div className="fcv2-skeleton fcv2-skeleton-title" />
                  <div className="fcv2-skeleton fcv2-skeleton-line" />
                  <div className="fcv2-skeleton fcv2-skeleton-line short" />
                </article>
              ))}
            </section>
          ) : null}

          {shouldShowError ? (
            <section className="fcv2-state">
              <div className="fcv2-state-icon">!</div>
              <h2>We couldn't load coaches right now</h2>
              <p>{error ?? "Please try again in a few minutes or adjust your filters."}</p>
              <button type="button" onClick={resetFilters}>
                Retry search
              </button>
            </section>
          ) : null}

          {shouldShowEmpty && !shouldShowError ? (
            <section className="fcv2-state">
              <div className="fcv2-state-icon">🎾</div>
              <h2>No coaches match these filters</h2>
              <p>Broaden your distance, clear filters, or try a different focus area.</p>
              <button type="button" onClick={resetFilters}>
                Reset filters
              </button>
            </section>
          ) : null}

          {shouldShowResults ? (
            <section className="fcv2-grid">
              {filteredCoaches.map((coach) => (
                <article key={coach.id} className="fcv2-card">
                  <div className="fcv2-card-head">
                    <div className="fcv2-card-profile">
                      <div className="fcv2-card-avatar-wrap">
                        <div className="fcv2-card-avatar">
                          {coach.imageUrl ? <img src={coach.imageUrl} alt={coach.name} /> : coach.initials}
                        </div>
                        {coach.verified ? <span className="fcv2-verified-badge">✓</span> : null}
                      </div>

                      <div className="fcv2-card-title-block">
                        <h2>{coach.name}</h2>
                        {coach.certifications.length > 0 ? (
                          <div className="fcv2-card-certifications">
                            {coach.certifications.slice(0, 2).map((certification) => (
                              <span key={certification}>{certification}</span>
                            ))}
                          </div>
                        ) : null}
                        <div className="fcv2-card-meta">
                          {coach.reviewCount > 0 ? (
                            <>
                              <span className="rating">
                                <Star size={13} fill="currentColor" />
                                {coach.rating.toFixed(1)}
                              </span>
                              <span>({coach.reviewCount})</span>
                            </>
                          ) : null}
                          {coach.reviewCount === 0 && coach.studentCount ? <span>{coach.studentCount} students</span> : null}
                          {coach.distanceMiles !== null ? <span>{coach.distanceMiles.toFixed(1)} mi</span> : null}
                        </div>
                      </div>
                    </div>

                    <div className="fcv2-card-price">
                      <strong>{coach.lessonRates.private || "$0"}</strong>
                      <span>/hr</span>
                      {coach.groupRateValue !== null ? <small>{coach.lessonRates.group} group</small> : null}
                    </div>
                  </div>

                  <p className="fcv2-card-bio">{coach.bio}</p>

                  <div className="fcv2-card-tags">
                    {coach.specialties.slice(0, 3).map((specialty) => (
                      <span key={specialty}>{specialty}</span>
                    ))}
                    {coach.formats[0] ? <span className="format">{coach.formats[0]}</span> : null}
                  </div>

                  <div className="fcv2-card-footer">
                    <div className={`fcv2-card-availability${coach.availabilityWindows.length > 0 ? " is-open" : ""}`}>
                      <span className="dot" />
                      <span>
                        {coach.availabilityWindows.length > 0
                          ? `${coach.availabilityWindows.length} slot${coach.availabilityWindows.length === 1 ? "" : "s"} this week`
                          : "Availability on request"}
                      </span>
                    </div>

                    <div className="fcv2-card-actions">
                      <button type="button" className="ghost" onClick={() => navigate(`/coaches/${coach.id}`)}>
                        View profile
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          ) : null}
        </div>

        {showFiltersSheet ? (
          <div className="fcv2-mobile-sheet-overlay" onClick={() => setShowFiltersSheet(false)}>
            <aside className="fcv2-mobile-filter-sheet" onClick={(event) => event.stopPropagation()}>
              <div className="fcv2-mobile-sheet-head">
                <div>
                  <p>Refine results</p>
                  <h2>Filters</h2>
                </div>
                <button type="button" onClick={() => setShowFiltersSheet(false)}>
                  Close
                </button>
              </div>

              <div className="fcv2-mobile-filter-section">
                <span>Distance</span>
                <div className="fcv2-mobile-filter-chips">
                  {radiusOptions.map((radius) => (
                    <button
                      key={radius}
                      type="button"
                      className={selectedRadius === radius ? "active" : ""}
                      onClick={() => handleRadiusChange(radius)}
                    >
                      {radius}
                    </button>
                  ))}
                </div>
              </div>

              {levelOptions.length > 0 ? (
                <div className="fcv2-mobile-filter-section">
                  <span>Player level</span>
                  <div className="fcv2-mobile-filter-chips">
                    {levelOptions.map((level) => (
                      <button
                        key={level}
                        type="button"
                        className={activeFilters.levels.includes(level) ? "active" : ""}
                        onClick={() => toggleFilter("levels", level)}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {formatOptions.length > 0 ? (
                <div className="fcv2-mobile-filter-section">
                  <span>Format</span>
                  <div className="fcv2-mobile-filter-chips">
                    {formatOptions.map((format) => (
                      <button
                        key={format}
                        type="button"
                        className={activeFilters.formats.includes(format) ? "active" : ""}
                        onClick={() => toggleFilter("formats", format)}
                      >
                        {format}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {visibleAvailabilityOptions.length > 0 ? (
                <div className="fcv2-mobile-filter-section">
                  <span>Availability</span>
                  <div className="fcv2-mobile-filter-chips">
                    {visibleAvailabilityOptions.map((availability) => (
                      <button
                        key={availability}
                        type="button"
                        className={activeFilters.availability.includes(availability) ? "active" : ""}
                        onClick={() => toggleFilter("availability", availability)}
                      >
                        {availability}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="fcv2-mobile-sheet-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setActiveFilters({ levels: [], formats: [], availability: [] });
                    setSelectedRadius(radiusOptions[1]);
                    setAppliedRadius(radiusOptions[1]);
                  }}
                >
                  Clear
                </button>
                <button type="button" className="primary" onClick={() => setShowFiltersSheet(false)}>
                  Apply filters
                </button>
              </div>
            </aside>
          </div>
        ) : null}

        {showLocationPicker ? (
          <div className="fcv2-location-overlay" onClick={closeLocationPicker}>
            <div onClick={(event) => event.stopPropagation()}>{renderLocationPickerPanel()}</div>
          </div>
        ) : null}

        <nav className="fcv2-mobile-tabbar" aria-label="Mobile navigation">
          <Link to="/">🏠<span>Home</span></Link>
          <Link to="/find-coaches" className="active">👤<span>Coaches</span></Link>
          <Link to="/group-lessons">👥<span>Groups</span></Link>
          <Link to="/matches">🏆<span>Match</span></Link>
          <Link to="/player/calendar">📅<span>Schedule</span></Link>
        </nav>
      </div>
    </MainLayout>
  );
};

export default FindCoaches;
