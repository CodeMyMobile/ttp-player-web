import { ArrowLeft, Loader2, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import MainLayout from "../components/MainLayout";
import FilterMenu, {
  type FilterMenuEvent,
  type SelectedLocation,
} from "../components/findPlayers/FilterMenu";
import SuggestedPlayerCard, {
  type SuggestedPlayer,
} from "../components/findPlayers/SuggestedPlayerCard";
import { useAuth } from "../context/AuthContext";
import useDebouncedValue from "../hooks/useDebouncedValue";
import { getSuggestedPlayerCheckLocation } from "../api/playerHome";
import { getStoredAuthToken } from "../services/authToken";
import ensureForScreen from "../utils/ensureForScreen";

import styles from "./FindPlayersPage.module.css";

const PER_PAGE = 10;
const DEFAULT_RADIUS = 10;
const USER_LOCATION_STORAGE_KEY = "player:web:user-location";
const SUGGEST_PLAYER_DETAIL_LIST = "/players/suggested/detail";

type Coordinates = { latitude: number; longitude: number };

interface FetchOptions {
  page: number;
  append: boolean;
  search: string;
  locationLabel: string;
  radiusValue: number;
  filters: Record<string, unknown>;
  position?: Coordinates;
}

const parsePlayers = (payload: unknown): SuggestedPlayer[] => {
  if (Array.isArray(payload)) {
    return payload as SuggestedPlayer[];
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.data)) {
      return record.data as SuggestedPlayer[];
    }
    if (Array.isArray(record.players)) {
      return record.players as SuggestedPlayer[];
    }
    if (Array.isArray(record.results)) {
      return record.results as SuggestedPlayer[];
    }
  }
  return [];
};

const extractPagination = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  const meta = record.meta as { pagination?: Record<string, unknown> } | undefined;
  if (meta?.pagination) {
    return meta.pagination;
  }
  if (record.pagination && typeof record.pagination === "object") {
    return record.pagination as Record<string, unknown>;
  }
  return undefined;
};

const getStoredLocation = (): Coordinates | null => {
  try {
    const raw = localStorage.getItem(USER_LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Coordinates | null;
    if (!parsed || typeof parsed.latitude !== "number" || typeof parsed.longitude !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const FindPlayersPage = () => {
  const navigate = useNavigate();
  const auth = useAuth() as { user?: { name?: string | null } } | undefined;
  const [playerToken] = useState(() => getStoredAuthToken({ defaultScheme: "token", preferScheme: "token" }) ?? undefined);
  const [allSuggestedPlayers, setAllSuggestedPlayers] = useState<SuggestedPlayer[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<SuggestedPlayer[]>([]);
  const [searchName, setSearchName] = useState("");
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, unknown>>({});
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(() => getStoredLocation());
  const [userPos, setUserPos] = useState<Coordinates | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [page, setPage] = useState(1);
  const [positionSet, setPositionSet] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef(true);

  const debouncedUserPos = useDebouncedValue(userPos, 500);

  const activePosition = useMemo(() => {
    if (selectedLocation?.latitude && selectedLocation?.longitude) {
      return { latitude: selectedLocation.latitude, longitude: selectedLocation.longitude };
    }
    return debouncedUserPos ?? undefined;
  }, [selectedLocation, debouncedUserPos]);

  const filtersKey = useMemo(() => JSON.stringify(selectedFilters), [selectedFilters]);
  const locationLabel = selectedLocation?.label ?? "";
  const positionKey = activePosition ? `${activePosition.latitude.toFixed(4)}:${activePosition.longitude.toFixed(4)}` : "";
  const hasDynamicFilters = useMemo(() => Object.keys(selectedFilters).length > 0, [selectedFilters]);

  useEffect(() => {
    ensureForScreen({ featureLabel: "nearby players" });
  }, []);

  useEffect(() => {
    if (!playerToken) {
      setError("Please sign in to search for players.");
      setInitialLoadComplete(true);
    }
  }, [playerToken]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (userLocation) {
      setUserPos(userLocation);
      setSelectedLocation((previous) => {
        if (previous?.isCurrentLocation) {
          return {
            label: previous.label ?? "Current location",
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            isCurrentLocation: true,
          };
        }
        if (!previous) {
          return {
            label: "Current location",
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            isCurrentLocation: true,
          };
        }
        return previous;
      });
    }
  }, [userLocation]);

  useEffect(() => {
    if (userLocation) return;
    if (!navigator.geolocation) {
      console.warn("Geolocation not available in this browser");
      return;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserLocation(coords);
        try {
          localStorage.setItem(USER_LOCATION_STORAGE_KEY, JSON.stringify(coords));
        } catch (storageError) {
          console.warn("Failed to persist user location", storageError);
        }
      },
      (geoError) => {
        console.error("Failed to obtain location", geoError);
      },
      { enableHighAccuracy: true, maximumAge: 1000 * 60 * 10, timeout: 1000 * 15 },
    );
    return () => {
      cancelled = true;
    };
  }, [userLocation]);

  useEffect(() => {
    const ready = Boolean(activePosition) || Boolean(locationLabel);
    if (ready !== positionSet) {
      setPositionSet(ready);
    }
  }, [activePosition, locationLabel, positionSet]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
  }, [filtersKey, searchName, radius, locationLabel, positionKey]);

  const fetchPlayers = useCallback(
    async ({ page: pageToLoad, append, search, locationLabel: locationSearch, radiusValue, filters, position }: FetchOptions) => {
      if (!playerToken) {
        setError("Missing authentication token");
        return [] as SuggestedPlayer[];
      }
      if (!isMountedRef.current) {
        return [] as SuggestedPlayer[];
      }

      setIsFetching(true);
      // eslint-disable-next-line no-console
      console.log("Fetching players within radius", { radius: radiusValue, search, page: pageToLoad, locationSearch, filters, position });

      try {
        const response = await getSuggestedPlayerCheckLocation({
          token: playerToken,
          perPage: PER_PAGE,
          page: pageToLoad,
          search,
          location: locationSearch,
          position,
          radius: radiusValue === 0 ? 0 : radiusValue,
          filters,
        });
        const players = parsePlayers(response);
        const pagination = extractPagination(response);
        if (!isMountedRef.current) {
          return players;
        }

        setError(null);
        setInitialLoadComplete(true);
        setAllSuggestedPlayers((prev) => (append ? [...prev, ...players] : players));
        setFilteredPlayers((prev) => (append ? [...prev, ...players] : players));

        if (pagination) {
          const totalPages = Number(pagination.total_pages ?? pagination.totalPages ?? pagination.total);
          const currentPage = Number(pagination.current_page ?? pagination.currentPage ?? pageToLoad);
          if (Number.isFinite(totalPages) && Number.isFinite(currentPage) && totalPages > 0) {
            setHasMore(currentPage < totalPages);
          } else if (Array.isArray(players)) {
            setHasMore(players.length >= PER_PAGE);
          }
        } else {
          setHasMore(players.length >= PER_PAGE);
        }

        return players;
      } catch (err) {
        console.error("Failed to fetch suggested players", err);
        if (!isMountedRef.current) {
          return [] as SuggestedPlayer[];
        }
        setInitialLoadComplete(true);
        setHasMore(false);
        setAllSuggestedPlayers((prev) => (append ? prev : []));
        setFilteredPlayers((prev) => (append ? prev : []));
        setError((err as Error)?.message ?? "We couldn't load players");
        return [] as SuggestedPlayer[];
      } finally {
        if (isMountedRef.current) {
          setIsFetching(false);
        }
      }
    },
    [playerToken],
  );

  useEffect(() => {
    if (!playerToken) return;
    if (!positionSet && !searchName && !hasDynamicFilters && !locationLabel) {
      return;
    }
    void fetchPlayers({
      page,
      append: page > 1,
      search: searchName,
      locationLabel,
      radiusValue: radius,
      filters: selectedFilters,
      position: activePosition,
    });
  }, [
    activePosition,
    fetchPlayers,
    hasDynamicFilters,
    locationLabel,
    page,
    playerToken,
    positionSet,
    radius,
    searchName,
    selectedFilters,
  ]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && hasMore && !isFetching) {
            setPage((prev) => prev + 1);
          }
        });
      },
      { rootMargin: "240px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isFetching]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (!initialLoadComplete) return;
      // eslint-disable-next-line no-console
      console.log("Screen regained focus, refreshing suggested players");
      void fetchPlayers({
        page: 1,
        append: false,
        search: searchName,
        locationLabel,
        radiusValue: radius,
        filters: selectedFilters,
        position: activePosition,
      });
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [
    activePosition,
    fetchPlayers,
    initialLoadComplete,
    locationLabel,
    radius,
    searchName,
    selectedFilters,
  ]);

  const clearFilters = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log("Clearing all filters to defaults");
    setSearchName("");
    setRadius(DEFAULT_RADIUS);
    setSelectedFilters({});
    setSelectedLocation((prev) => {
      if (userLocation) {
        return {
          label: "Current location",
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          isCurrentLocation: true,
        };
      }
      if (prev?.isCurrentLocation) {
        return prev;
      }
      return null;
    });
    setUserPos(userLocation);
    setPage(1);
    setHasMore(true);
    setError(null);
    setAllSuggestedPlayers([]);
    setFilteredPlayers([]);
    setInitialLoadComplete(false);
  }, [userLocation]);

  const handleFilterChange = useCallback(
    (event: FilterMenuEvent) => {
      switch (event.type) {
        case "name":
          setSearchName(event.value);
          break;
        case "location":
          setSelectedLocation(event.location);
          if (event.location?.latitude && event.location?.longitude) {
            const coords = { latitude: event.location.latitude, longitude: event.location.longitude };
            setUserPos(coords);
            setUserLocation(coords);
            try {
              localStorage.setItem(USER_LOCATION_STORAGE_KEY, JSON.stringify(coords));
            } catch (storageError) {
              console.warn("Failed to persist user location", storageError);
            }
          } else if (!event.location) {
            setUserPos(null);
          }
          break;
        case "dynamic":
          if ("filters" in event) {
            setSelectedFilters(event.filters);
          } else {
            const nextValue = event.value;
            const shouldRemove =
              nextValue === null ||
              nextValue === undefined ||
              (typeof nextValue === "string" && !nextValue.trim()) ||
              (Array.isArray(nextValue) && nextValue.length === 0);

            if (shouldRemove) {
              setSelectedFilters((prev) => {
                const next = { ...prev };
                delete next[event.key];
                return next;
              });
            } else {
              setSelectedFilters((prev) => ({ ...prev, [event.key]: nextValue }));
            }
          }
          break;
        case "clear":
          clearFilters();
          break;
        default:
          break;
      }
    },
    [clearFilters],
  );

  const handleRadiusChange = useCallback((value: number) => {
    setRadius(value);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // eslint-disable-next-line no-console
    console.log("Pull-to-refresh triggered for suggested players");
    try {
      await fetchPlayers({
        page: 1,
        append: false,
        search: searchName,
        locationLabel,
        radiusValue: radius,
        filters: selectedFilters,
        position: activePosition,
      });
      setPage(1);
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [activePosition, fetchPlayers, locationLabel, radius, searchName, selectedFilters]);

  const handleViewDetails = useCallback(
    (player: SuggestedPlayer) => {
      navigate(SUGGEST_PLAYER_DETAIL_LIST, { state: { player } });
    },
    [navigate],
  );

  const handleContact = useCallback((player: SuggestedPlayer) => {
    if (!player.phone_number) return;
    const sanitized = String(player.phone_number).replace(/[^\d+]/g, "");
    window.open(`tel:${sanitized}`);
  }, []);

  const radiusLabel = radius ? `${radius} miles` : "All";
  const metricsLabel = `Radius: ${radiusLabel} & player found: ${filteredPlayers.length}`;
  const isEmpty = !isFetching && initialLoadComplete && filteredPlayers.length === 0 && !error;

  return (
    <MainLayout>
      <div className={styles.page}>
        <header className={styles.topBar}>
          <div className={styles.actions}>
            <button type="button" className={styles.backButton} onClick={() => navigate(-1)}>
              <ArrowLeft size={18} aria-hidden /> Back
            </button>
            <button type="button" className={styles.refreshButton} onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCcw size={16} aria-hidden />
              {isRefreshing ? "Refreshing" : "Pull to refresh"}
            </button>
          </div>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>Search for a player</h1>
            <p className={styles.subtitle}>Discover nearby partners that match your playing style.</p>
          </div>
        </header>

        <FilterMenu
          onFilterChange={handleFilterChange}
          userPos={userLocation ?? userPos ?? null}
          showName
          user={auth?.user ?? null}
          radius={radius}
          onRadiusChange={handleRadiusChange}
          searchValue={searchName}
          selectedLocation={selectedLocation}
          selectedFilters={selectedFilters}
        />

        <div className={styles.metrics}>
          <span>{metricsLabel}</span>
          {error ? <strong>{error}</strong> : null}
        </div>

        {isFetching && !allSuggestedPlayers.length ? (
          <div className={styles.loader}>
            <Loader2 className={styles.spinner} size={24} aria-hidden />
          </div>
        ) : null}

        {error && !isFetching ? (
          <div className={styles.error} role="alert">
            <p>{error}</p>
            <button type="button" className={styles.refreshButton} onClick={handleRefresh}>
              Retry
            </button>
          </div>
        ) : null}

        {isEmpty ? (
          <div className={styles.empty}>
            <p>No players found. Try widening your radius or clearing filters.</p>
            <button type="button" className={styles.refreshButton} onClick={clearFilters}>
              Reset filters
            </button>
          </div>
        ) : null}

        <section className={styles.list} aria-live="polite">
          {filteredPlayers.map((player) => (
            <SuggestedPlayerCard
              key={player.user_id ?? player.id ?? `${player.full_name}-${player.name}`}
              player={player}
              onViewDetails={handleViewDetails}
              onContact={handleContact}
            />
          ))}
        </section>

        <div ref={loadMoreRef} className={styles.sentinel} aria-hidden />

        {isFetching && allSuggestedPlayers.length ? (
          <div className={styles.loader}>
            <Loader2 className={styles.spinner} size={24} aria-hidden />
          </div>
        ) : null}
      </div>
    </MainLayout>
  );
};

export default FindPlayersPage;
