/// <reference types="google.maps" />

import Autocomplete from "react-google-autocomplete";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Calendar, Filter, MapPin, MessageCircle, Search, Star, Users } from "lucide-react";
import {
  identityValues,
  isOpenMatch,
  listMatches,
  normalizeMatchRecord,
  type NormalizedMatch,
} from "../api/matches";
import { useAuth } from "../context/AuthContext";
import MainLayout from "../components/MainLayout";
import { colors, typography } from "../lib/theme";
import { getStoredAuthToken } from "../services/authToken";

import "./BrowseMatchesPage.css";

const distanceOptions = ["5 mi", "10 mi", "20 mi", "50 mi", "All"];
const tabs = ["My Matches", "Hosting", "Open", "Today", "Tomorrow", "Weekend", "Drafts", "Archived"];

const relationshipLabel: Record<string, string> = {
  host: "Hosting",
  participant: "Joined",
};

type Coordinates = { latitude: number; longitude: number };

type SelectedLocation = {
  label: string;
  latitude?: number;
  longitude?: number;
  isCurrentLocation?: boolean;
};

const USER_LOCATION_STORAGE_KEY = "player:web:user-location";

const getStoredLocation = (): Coordinates | null => {
  try {
    const raw = localStorage.getItem(USER_LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Coordinates | null;
    if (!parsed) return null;
    if (typeof parsed.latitude !== "number" || typeof parsed.longitude !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const storeLocation = (coords: Coordinates | null) => {
  try {
    if (!coords) {
      localStorage.removeItem(USER_LOCATION_STORAGE_KEY);
      return;
    }
    localStorage.setItem(USER_LOCATION_STORAGE_KEY, JSON.stringify(coords));
  } catch {
    // ignore storage errors
  }
};

const formatCoordinatesLabel = (coords: Coordinates | null) => {
  if (!coords) {
    return "";
  }

  const latitude = Math.abs(coords.latitude).toFixed(2);
  const longitude = Math.abs(coords.longitude).toFixed(2);
  const latHemisphere = coords.latitude >= 0 ? "N" : "S";
  const lonHemisphere = coords.longitude >= 0 ? "E" : "W";

  return `${latitude}° ${latHemisphere}, ${longitude}° ${lonHemisphere}`;
};

const sanitizeLocationLabel = (label: string) => label.replace(/\s+/g, " ").trim().toLowerCase();

const buildLocationSearch = (location: SelectedLocation | null): string => {
  if (!location) {
    return "";
  }

  if (location.isCurrentLocation) {
    return "";
  }

  const label = location.label?.trim();
  if (!label) {
    return "";
  }

  const normalized = sanitizeLocationLabel(label);
  if (!normalized || normalized === "current location") {
    return "";
  }

  return label;
};

const parseDistanceMiles = (value: string): number => {
  const match = /([0-9.]+)/.exec(value);
  return match ? Number.parseFloat(match[1]) : Number.POSITIVE_INFINITY;
};

const isHostingMatch = (match: NormalizedMatch, userIdentities: string[]) => {
  const matchType = match.type?.toLowerCase();
  const matchTypeIsHosted = matchType === "hosted" || matchType?.includes("hosted");
  const participantHostMatch =
    match.participants?.some(
      (participant) =>
        participant.hosting &&
        ((participant.identityIds?.some((id) => userIdentities.includes(id)) ?? false) || participant.isCurrentUser),
    ) ?? false;

  const hostIdentityMatch =
    match.hostIdentityIds?.some((identityId) => userIdentities.includes(identityId)) ?? false;

  return match.relationship === "host" || matchTypeIsHosted || participantHostMatch || hostIdentityMatch;
};

const getHostDisplayName = (match: NormalizedMatch, isHost: boolean) => {
  const hostingParticipants = match.participants?.filter((participant) => participant.hosting) ?? [];

  const currentUserHost = hostingParticipants.find((participant) => participant.isCurrentUser);
  if (currentUserHost?.name) return currentUserHost.name;

  const namedHost = hostingParticipants.find((participant) => participant.name);
  if (namedHost?.name) return namedHost.name;

  if (match.hostName) return match.hostName;
  return isHost ? "You" : undefined;
};

const BrowseMatchesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth() as { user?: unknown };
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [matches, setMatches] = useState<NormalizedMatch[]>([]);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [selectedDistance, setSelectedDistance] = useState(distanceOptions[0]);
  const [selectedTab, setSelectedTab] = useState(tabs[0]);
  const storedLocation = useMemo(() => getStoredLocation(), []);
  const [position, setPosition] = useState<Coordinates | null>(storedLocation);
  const [locationFilter, setLocationFilter] = useState<SelectedLocation | null>(null);
  const [locationSearchTerm, setLocationSearchTerm] = useState("");
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "ready" | "error">(
    storedLocation ? "ready" : "idle",
  );
  const [resolvedLocationLabel, setResolvedLocationLabel] = useState<string>(() =>
    storedLocation ? formatCoordinatesLabel(storedLocation) : "",
  );
  const currentUserIdentities = useMemo(() => identityValues(user), [user]);

  const locationLabel = (() => {
    if (locationFilter) {
      return locationFilter.label;
    }

    if (locationStatus === "loading") {
      return "Locating…";
    }

    if (locationStatus === "error") {
      return "Location unavailable";
    }

    if (locationStatus === "ready") {
      if (resolvedLocationLabel) {
        return resolvedLocationLabel;
      }
      if (position) {
        return formatCoordinatesLabel(position) || "Current location";
      }
      return "Current location";
    }

    return resolvedLocationLabel || "";
  })();

  const applyLocationFilter = useCallback((nextLocation: SelectedLocation | null) => {
    if (nextLocation) {
      const hasCoords =
        typeof nextLocation.latitude === "number" && typeof nextLocation.longitude === "number";

      if (hasCoords) {
        const coords: Coordinates = {
          latitude: nextLocation.latitude,
          longitude: nextLocation.longitude,
        };
        setPosition(coords);
        storeLocation(coords);
      } else {
        setPosition(null);
        storeLocation(null);
      }

      if (nextLocation.isCurrentLocation) {
        setLocationFilter(null);
      } else {
        setLocationFilter({ ...nextLocation, isCurrentLocation: false });
      }

      setResolvedLocationLabel(nextLocation.label);
      setLocationStatus("ready");
      setLocationSearchTerm(nextLocation.label);
      setGeoError("");
      setShowLocationPicker(false);
      return;
    }

    setLocationFilter(null);
    setLocationSearchTerm("");
    setGeoError("");
    setShowLocationPicker(false);
    setResolvedLocationLabel("");
    setLocationStatus("idle");
    setPosition(null);
    storeLocation(null);
  }, []);

  const detectCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      const message = "Location detection is not supported in this browser.";
      setGeoError(message);
      setLocationStatus("error");
      setResolvedLocationLabel("");
      return;
    }

    setIsDetectingLocation(true);
    setLocationStatus("loading");
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (nextPosition) => {
        setIsDetectingLocation(false);
        const coords: Coordinates = {
          latitude: nextPosition.coords.latitude,
          longitude: nextPosition.coords.longitude,
        };
        setPosition(coords);
        storeLocation(coords);
        setLocationFilter(null);
        setResolvedLocationLabel(formatCoordinatesLabel(coords));
        setLocationStatus("ready");
        setLocationSearchTerm("");
      },
      (error) => {
        setIsDetectingLocation(false);
        console.error("Failed to detect current location", error);
        const message =
          error.message || "We couldn't detect your location. Please allow access and try again.";
        setGeoError(message);
        setLocationStatus("error");
        setResolvedLocationLabel("");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }, []);

  const closeLocationPicker = useCallback(() => {
    setShowLocationPicker(false);
    setGeoError("");
    setLocationSearchTerm(locationFilter?.label ?? "");
  }, [locationFilter?.label]);

  useEffect(() => {
    if (!position && locationStatus === "idle" && !isDetectingLocation) {
      detectCurrentLocation();
    }
  }, [position, locationStatus, isDetectingLocation, detectCurrentLocation]);

  useEffect(() => {
    if (!position || locationFilter) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const lookupLocationName = async () => {
      try {
        const query = new URLSearchParams({
          format: "jsonv2",
          lat: position.latitude.toString(),
          lon: position.longitude.toString(),
        });

        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?${query.toString()}`,
          {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("Failed to lookup location");
        }

        const data = await response.json();
        if (cancelled) {
          return;
        }

        const address = (data?.address ?? {}) as Record<string, unknown>;
        const locality =
          (address.city as string | undefined) ||
          (address.town as string | undefined) ||
          (address.village as string | undefined) ||
          (address.hamlet as string | undefined) ||
          (address.suburb as string | undefined) ||
          (address.county as string | undefined);
        const region = (address.state as string | undefined) || (address.region as string | undefined);
        const countryCode =
          typeof address.country_code === "string" ? address.country_code.toUpperCase() : null;

        const labelParts = [locality, region, countryCode].filter(Boolean) as string[];
        const resolvedLabel = labelParts.length
          ? labelParts.join(", ")
          : (data?.display_name as string | undefined)?.split(",").slice(0, 2).join(", ") || "";

        setResolvedLocationLabel(resolvedLabel || formatCoordinatesLabel(position));
      } catch (lookupError) {
        if (cancelled) {
          return;
        }
        console.error("Failed to resolve location", lookupError);
        setResolvedLocationLabel(formatCoordinatesLabel(position));
      }
    };

    lookupLocationName();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [position, locationFilter]);

  const locationQuery = useMemo(() => buildLocationSearch(locationFilter), [locationFilter]);
  const hasLocationFilter = Boolean(locationFilter);

  useEffect(() => {
    setAppliedSearch(searchTerm.trim());
  }, [searchTerm]);

  const fetchMatches = useCallback(
    async (signal: AbortSignal) => {
      setIsLoadingMatches(true);
      setMatchesError(null);

      const distanceMiles = parseDistanceMiles(selectedDistance);
      const isHostingTab = selectedTab === "Hosting";
      const personalFilters = { includeHidden: true as const, include_hidden: true as const };
      const tabFilters = (() => {
        if (selectedTab === "My Matches") return { filter: "my" as const, ...personalFilters };
        if (isHostingTab) return { filter: "my" as const, ...personalFilters };
        if (selectedTab === "Open") return {};
        if (selectedTab === "Drafts") return { filter: "my" as const, status: "draft" as const, ...personalFilters };
        if (selectedTab === "Archived") return { filter: "archieve" as const, ...personalFilters };
        if (selectedTab === "Today" || selectedTab === "Tomorrow" || selectedTab === "Weekend") return {};
        return {};
      })();
      const isMyMatchesFilter = tabFilters.filter === "my" || tabFilters.filter === "archieve";
      const searchQuery = (isMyMatchesFilter ? appliedSearch : appliedSearch || locationQuery).trim();
      const perPage = isHostingTab ? 50 : 20;
      const hasLocationSelection = Boolean(locationFilter || position);
      const locationParams = hasLocationSelection && !isMyMatchesFilter
        ? {
            latitude: position?.latitude,
            longitude: position?.longitude,
            distance: Number.isFinite(distanceMiles) ? distanceMiles : undefined,
          }
        : {};

      try {
        const token = getStoredAuthToken({ preferScheme: "Token" });
        const response = await listMatches({
          page: 1,
          perPage,
          search: searchQuery || undefined,
          ...locationParams,
          ...tabFilters,
          token: token ?? undefined,
          signal,
        });

        const normalized = response.matches.map((match) =>
          normalizeMatchRecord(match, { currentUser: user }),
        );
        const visibleMatches = selectedTab === "Open" ? normalized.filter(isOpenMatch) : normalized;
        setMatches(visibleMatches);
      } catch (fetchError) {
        if (signal.aborted) return;
        console.error("Failed to load matches", fetchError);
        setMatchesError(
          fetchError instanceof Error ? fetchError.message : "Unable to load matches right now.",
        );
      } finally {
        if (!signal.aborted) {
          setIsLoadingMatches(false);
        }
      }
    },
    [
      appliedSearch,
      locationFilter,
      locationQuery,
      position?.latitude,
      position?.longitude,
      selectedDistance,
      selectedTab,
      user,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchMatches(controller.signal);
    return () => controller.abort();
  }, [fetchMatches, refreshIndex]);

  const handleRetryMatches = () => setRefreshIndex((value) => value + 1);

  const themeVars = useMemo(
    () =>
      ({
        "--matches-distance-bg": colors.filterChipBg,
        "--matches-distance-hover": colors.filterChipHover,
        "--matches-distance-selected-bg": colors.availableBg,
        "--matches-distance-selected-border": colors.primarySuccess,
        "--matches-distance-selected-text": colors.availableText,
        "--matches-text": colors.primaryText,
        "--matches-muted": colors.secondaryText,
        "--matches-border": colors.border,
        "--matches-surface": colors.surface,
        "--matches-success": colors.primarySuccess,
        "--matches-font": typography.fontFamily,
      }) as CSSProperties,
    [],
  );

  return (
    <MainLayout>
      <div className="matches-page" style={themeVars}>
        <header className="matches-hero">
          <div className="matches-hero__text">
            <h1 className="matches-hero__title">Browse Local Matches</h1>
            <p className="matches-hero__subtitle">See what's nearby and jump back in.</p>
          </div>
          <div className="matches-hero__actions">
            <button
              type="button"
              className="matches-create-btn"
              onClick={() => navigate("/matches/create")}
            >
              + Create Match
            </button>
            <button type="button" className="matches-filter-btn">
              <Filter size={18} aria-hidden="true" />
              Filters
            </button>
          </div>
        </header>

        <section className="location-panel">
          <div className="location-panel__chips" role="group" aria-label="Distance from your current location">
            <button
              type="button"
              className={`distance-chip distance-chip--location${showLocationPicker ? " selected" : ""}`}
              aria-label={locationLabel ? `Selected location: ${locationLabel}` : "Select location"}
              aria-expanded={showLocationPicker}
              onClick={() => {
                setGeoError("");
                setShowLocationPicker((prev) => {
                  if (!prev) {
                    setLocationSearchTerm(locationFilter?.label ?? "");
                  }
                  return !prev;
                });
              }}
            >
              <MapPin size={16} aria-hidden="true" />
              {locationLabel || "Select location"}
            </button>
            {distanceOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={`distance-chip${selectedDistance === option ? " selected" : ""}`}
                onClick={() => setSelectedDistance(option)}
                aria-pressed={selectedDistance === option}
              >
                {option}
              </button>
            ))}
          </div>
        </section>

        {showLocationPicker ? (
          <section className="matches-location-panel" aria-label="Location picker">
            <Autocomplete
              apiKey={import.meta.env.VITE_GOOGLE_API_KEY || undefined}
              placeholder="Search for a city, club, or court"
              className="matches-autocomplete-input"
              value={locationSearchTerm}
              onChange={(event) => setLocationSearchTerm(event.target.value)}
              onPlaceSelected={(place: google.maps.places.PlaceResult | null) => {
                if (!place) {
                  setGeoError("Please choose a location from the suggestions.");
                  return;
                }

                const lat = place.geometry?.location?.lat?.();
                const lng = place.geometry?.location?.lng?.();
                const label = place.formatted_address || place.name || locationSearchTerm || "Custom location";

                if (
                  typeof lat === "number" &&
                  !Number.isNaN(lat) &&
                  typeof lng === "number" &&
                  !Number.isNaN(lng)
                ) {
                  applyLocationFilter({ label, latitude: lat, longitude: lng });
                } else {
                  setGeoError("We couldn't read that location's coordinates. Try another search.");
                }
              }}
              options={{
                types: ["geocode", "establishment"],
                fields: ["formatted_address", "geometry", "name", "address_components"],
              }}
            />

            <div className="matches-location-actions">
              <button
                type="button"
                className="matches-location-detect"
                onClick={detectCurrentLocation}
                disabled={isDetectingLocation}
              >
                {isDetectingLocation ? "Detecting location..." : "Use my current location"}
              </button>
              <div className="matches-location-secondary-actions">
                {hasLocationFilter ? (
                  <button type="button" className="matches-location-secondary" onClick={() => applyLocationFilter(null)}>
                    Clear location
                  </button>
                ) : null}
                <button type="button" className="matches-location-secondary" onClick={closeLocationPicker}>
                  Close
                </button>
              </div>
            </div>

            <div className="matches-location-summary">
              <h4>Selected location</h4>
              {locationFilter ? (
                <p>{locationFilter.label}</p>
              ) : position ? (
                <p>
                  Lat {position.latitude.toFixed(4)}, Lng {position.longitude.toFixed(4)}
                </p>
              ) : (
                <p>No location selected yet.</p>
              )}
            </div>

            {geoError ? <p className="matches-location-error">{geoError}</p> : null}
            {!import.meta.env.VITE_GOOGLE_API_KEY ? (
              <p className="matches-location-tip">Tip: Provide a Google Places API key to enable location search suggestions.</p>
            ) : null}
          </section>
        ) : null}

        <section className="matches-main">
          <div className="matches-toolbar">
            <nav className="matches-tabs" aria-label="Match filters">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`tab${selectedTab === tab ? " active" : ""}`}
                  onClick={() => setSelectedTab(tab)}
                  aria-pressed={selectedTab === tab}
                >
                  {tab}
                </button>
              ))}
            </nav>
            <div className="toolbar-actions">
              <div className="search-field">
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search matches"
                  aria-label="Search matches"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="matches-grid">
            {isLoadingMatches ? (
              <div className="matches-state" role="status">
                Loading matches…
              </div>
            ) : matchesError ? (
              <div className="matches-state matches-state--error" role="alert">
                <p className="matches-state__title">We couldn't load matches right now.</p>
                <p className="matches-state__detail">{matchesError}</p>
                <button type="button" className="matches-state__button" onClick={handleRetryMatches}>
                  Try again
                </button>
              </div>
            ) : (
              matches.map((match) => {
                const isHost = isHostingMatch(match, currentUserIdentities);
                const isParticipant = !isHost && match.relationship === "participant";
                const playersJoined = match.playersJoined ?? 0;
                const computedTotal =
                  match.totalSpots !== undefined && match.totalSpots !== null
                    ? match.totalSpots
                    : playersJoined + (match.playersNeeded ?? 0);
                const totalSpots = computedTotal > 0 ? computedTotal : playersJoined;
                const spotsAvailable = Math.max(totalSpots - playersJoined, 0);
                const playersNeeded = match.playersNeeded ?? spotsAvailable;
                const availabilityLabel =
                  totalSpots > 0
                    ? spotsAvailable === 0
                      ? "Match is full"
                      : `${spotsAvailable} spot${spotsAvailable === 1 ? "" : "s"} available`
                    : "Spots available";
                const playersLabel =
                  totalSpots > 0
                    ? `${playersJoined}/${totalSpots} players`
                    : `${playersJoined} player${playersJoined === 1 ? "" : "s"}`;
                const roleLabel = isHost ? "Hosting" : isParticipant ? relationshipLabel[match.relationship] : null;
                const isInviteOnlyPill =
                  match.visibility === "private" ||
                  match.visibilityLabel?.toLowerCase() === "invite only";
                const showVisibilityPill =
                  Boolean(match.visibilityLabel && match.visibilityLabel !== match.access && !isInviteOnlyPill);
                const hostDisplayName = getHostDisplayName(match, isHost);
                const hostingParticipant = match.participants?.some((participant) => participant.hosting) ?? false;
                const showHostPill = Boolean(hostDisplayName) && (isHost || hostingParticipant);

                return (
                  <article key={match.id} className="match-card">
                    <header className="match-card__header">
                      <div className="match-pills">
                        <span className={`match-status-pill ${match.access.toLowerCase()}`}>
                          {match.access}
                        </span>
                        {showVisibilityPill ? (
                          <span className="match-status-pill visibility">{match.visibilityLabel}</span>
                        ) : null}
                        {roleLabel ? <span className="match-status-pill subtle">{roleLabel}</span> : null}
                        {isHost ? <span className="match-host-pill match-host-pill--header">Host</span> : null}
                      </div>
                      {spotsAvailable > 0 && playersNeeded > 0 ? (
                        <span className="match-needed">{playersNeeded} needed</span>
                      ) : null}
                    </header>

                    <div className="match-card__body">
                      <div className="match-detail">
                        <Calendar size={18} aria-hidden="true" />
                        <p className="match-detail__primary">{match.startDisplay}</p>
                      </div>
                      <div className="match-detail">
                        <MapPin size={18} aria-hidden="true" />
                        <div>
                          <p className="match-detail__primary">{match.location}</p>
                          <p className="match-detail__secondary">{match.distance}</p>
                        </div>
                      </div>
                      {hostDisplayName ? (
                        <div className="match-detail match-detail--host">
                          <Users size={18} aria-hidden="true" />
                          <div>
                            <p className="match-detail__primary match-detail__host-primary">
                              {hostDisplayName}
                              {showHostPill ? <span className="match-host-pill">Host</span> : null}
                            </p>
                            <p className="match-detail__secondary">Organizer</p>
                          </div>
                        </div>
                      ) : null}
                      <div className="match-detail">
                        <Users size={18} aria-hidden="true" />
                        <div>
                          <p className="match-detail__primary">{playersLabel}</p>
                          <p className="match-detail__secondary">{availabilityLabel}</p>
                        </div>
                      </div>
                      {match.level ? (
                        <div className="match-detail">
                          <Star size={18} aria-hidden="true" />
                          <div>
                            <p className="match-detail__primary">Suggested level: {match.level.summary}</p>
                            {match.level.detail ? (
                              <p className="match-detail__secondary">{match.level.detail}</p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                      {match.format ? (
                        <div className="match-detail">
                          <Activity size={18} aria-hidden="true" />
                          <div>
                            <p className="match-detail__primary">Match format: {match.format}</p>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <footer className="match-card__footer">
                      {isHost ? (
                        <>
                          <button
                            type="button"
                            className="match-action primary"
                            onClick={() => navigate(`/matches/${match.id}`)}
                          >
                            View &amp; manage
                          </button>
                          <button type="button" className="match-action" disabled>
                            <MessageCircle size={16} aria-hidden="true" />
                            Message group
                          </button>
                        </>
                      ) : isParticipant ? (
                        <>
                          <button
                            type="button"
                            className="match-action"
                            onClick={() => navigate(`/matches/${match.id}`)}
                          >
                            View match
                          </button>
                          <button type="button" className="match-action primary">
                            <MessageCircle size={16} aria-hidden="true" />
                            Message group
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="match-action primary"
                          onClick={() => navigate(`/matches/${match.id}`)}
                        >
                          View match
                        </button>
                      )}
                    </footer>
                  </article>
                );
              })
            )}
            {!isLoadingMatches && !matchesError && matches.length === 0 ? (
              <div className="matches-empty">No matches found for these filters yet.</div>
            ) : null}
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default BrowseMatchesPage;
