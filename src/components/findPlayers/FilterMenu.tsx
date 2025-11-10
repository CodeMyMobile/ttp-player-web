/// <reference types="google.maps" />

import Autocomplete from "react-google-autocomplete";
import { MapPin, Plus, RefreshCcw, Search, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import styles from "./FilterMenu.module.css";

export interface SelectedLocation {
  label: string;
  latitude?: number;
  longitude?: number;
  isCurrentLocation?: boolean;
}

export type FilterMenuEvent =
  | { type: "name"; value: string }
  | { type: "location"; location: SelectedLocation | null }
  | { type: "dynamic"; key: string; value: unknown }
  | { type: "dynamic"; filters: Record<string, unknown> }
  | { type: "clear" };

interface FilterMenuProps {
  onFilterChange: (event: FilterMenuEvent) => void;
  userPos: { latitude: number; longitude: number } | null;
  showName?: boolean;
  user?: { name?: string | null } | null;
  radius: number;
  onRadiusChange: (value: number) => void;
  searchValue: string;
  selectedLocation: SelectedLocation | null;
  selectedFilters: Record<string, unknown>;
}

const FilterMenu = ({
  onFilterChange,
  userPos,
  showName = true,
  user,
  radius,
  onRadiusChange,
  searchValue,
  selectedLocation,
  selectedFilters,
}: FilterMenuProps) => {
  const [locationSearchTerm, setLocationSearchTerm] = useState(selectedLocation?.label ?? "");
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [pendingKey, setPendingKey] = useState("");
  const [pendingValue, setPendingValue] = useState("");

  useEffect(() => {
    setLocationSearchTerm(selectedLocation?.label ?? "");
  }, [selectedLocation]);

  const resolvedUserName = useMemo(() => {
    if (!user) return "";
    if (typeof user.name === "string" && user.name.trim()) {
      return user.name;
    }
    return "";
  }, [user]);

  const applyLocationFilter = useCallback(
    (location: SelectedLocation | null) => {
      // eslint-disable-next-line no-console
      console.log("Filter change", { type: "location", location });
      onFilterChange({ type: "location", location });
      setLocationSearchTerm(location?.label ?? "");
      setGeoError("");
      setShowLocationPicker(false);
    },
    [onFilterChange],
  );

  const handleUseCurrentLocation = useCallback(() => {
    if (!userPos) return;
    const location: SelectedLocation = {
      label: "Current location",
      latitude: userPos.latitude,
      longitude: userPos.longitude,
      isCurrentLocation: true,
    };
    applyLocationFilter(location);
  }, [applyLocationFilter, userPos]);

  const detectCurrentLocation = useCallback(() => {
    if (userPos) {
      const location: SelectedLocation = {
        label: "Current location",
        latitude: userPos.latitude,
        longitude: userPos.longitude,
        isCurrentLocation: true,
      };
      applyLocationFilter(location);
      return;
    }
    if (!navigator.geolocation) {
      setGeoError("Location detection is not supported in this browser.");
      return;
    }
    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsDetectingLocation(false);
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        const location: SelectedLocation = {
          label: "Current location",
          latitude: coords.latitude,
          longitude: coords.longitude,
          isCurrentLocation: true,
        };
        applyLocationFilter(location);
      },
      (error) => {
        setIsDetectingLocation(false);
        console.error("Failed to detect current location", error);
        setGeoError("We couldn't detect your location. Please allow access and try again.");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }, [applyLocationFilter, userPos]);

  const handleNameChange = useCallback(
    (value: string) => {
      // eslint-disable-next-line no-console
      console.log("Filter change", { type: "name", value });
      onFilterChange({ type: "name", value });
    },
    [onFilterChange],
  );

  const handleClearFilters = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log("Filter change", { type: "clear" });
    onFilterChange({ type: "clear" });
    setLocationSearchTerm("");
    setGeoError("");
    setShowLocationPicker(false);
    setPendingKey("");
    setPendingValue("");
  }, [onFilterChange]);

  const handleRadiusChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      // eslint-disable-next-line no-console
      console.log("Filter change", { type: "radius", value });
      onRadiusChange(value);
    },
    [onRadiusChange],
  );

  const handleSubmitDynamicFilter = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const key = pendingKey.trim();
      const value = pendingValue.trim();
      if (!key || !value) return;
      // eslint-disable-next-line no-console
      console.log("Filter change", { type: "dynamic", key, value });
      onFilterChange({ type: "dynamic", key, value });
      setPendingKey("");
      setPendingValue("");
    },
    [onFilterChange, pendingKey, pendingValue],
  );

  const handleRemoveFilter = useCallback(
    (key: string) => {
      // eslint-disable-next-line no-console
      console.log("Filter change", { type: "dynamic", key, value: null });
      onFilterChange({ type: "dynamic", key, value: null });
    },
    [onFilterChange],
  );

  return (
    <section className={styles.container} aria-label="Player filters">
      <div className={styles.headerRow}>
        <div className={styles.locationGroup}>
          <MapPin size={18} aria-hidden />
          <input
            className={styles.locationInput}
            placeholder="Search by city or club"
            value={locationSearchTerm}
            onClick={() => setShowLocationPicker(true)}
            onFocus={() => setShowLocationPicker(true)}
            readOnly
            aria-label="Search location"
          />
          <button
            type="button"
            className={styles.actionButton}
            onClick={handleUseCurrentLocation}
            disabled={!userPos}
          >
            <RefreshCcw size={16} aria-hidden /> Use current location
          </button>
        </div>
        <button
          type="button"
          className={styles.secondaryActionButton}
          onClick={() => setShowLocationPicker((prev) => !prev)}
        >
          {showLocationPicker ? "Hide location search" : "Change location"}
        </button>
        <div className={styles.radiusControl}>
          <label htmlFor="radius-slider">Search radius: {radius ? `${radius} miles` : "All"}</label>
          <input
            id="radius-slider"
            className={styles.radiusSlider}
            type="range"
            min={0}
            max={50}
            step={5}
            value={radius}
            onChange={handleRadiusChange}
          />
        </div>
      </div>

      {showLocationPicker ? (
        <div className={styles.locationPicker}>
          <Autocomplete
            apiKey={import.meta.env.VITE_GOOGLE_API_KEY}
            placeholder="Search for a city, club, or court"
            className={styles.autocompleteInput}
            value={locationSearchTerm}
            onChange={(event) => setLocationSearchTerm(event.target.value)}
            onPlaceSelected={(place: google.maps.places.PlaceResult | null) => {
              if (!place) {
                setGeoError("Please choose a location from the suggestions.");
                return;
              }
              const lat = place.geometry?.location?.lat?.();
              const lng = place.geometry?.location?.lng?.();
              const label =
                place.formatted_address || place.name || locationSearchTerm || "Custom location";
              if (
                typeof lat === "number" &&
                !Number.isNaN(lat) &&
                typeof lng === "number" &&
                !Number.isNaN(lng)
              ) {
                applyLocationFilter({
                  label,
                  latitude: lat,
                  longitude: lng,
                });
              } else {
                setGeoError("We couldn't read that location's coordinates. Try another search.");
              }
            }}
            options={{
              types: ["geocode", "establishment"],
              fields: [
                "formatted_address",
                "geometry",
                "name",
                "address_components",
              ],
            }}
          />

          <div className={styles.locationActions}>
            <button
              type="button"
              onClick={detectCurrentLocation}
              disabled={isDetectingLocation}
              className={styles.detectButton}
            >
              {isDetectingLocation ? "Detecting location..." : "Use my current location"}
            </button>
            <div className={styles.locationSecondaryActions}>
              {selectedLocation ? (
                <button
                  type="button"
                  onClick={() => {
                    applyLocationFilter(null);
                    setLocationSearchTerm("");
                  }}
                  className={styles.clearLocationButton}
                >
                  Clear location
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setShowLocationPicker(false);
                  setGeoError("");
                  setLocationSearchTerm(selectedLocation?.label ?? "");
                }}
                className={styles.closeLocationButton}
              >
                Close
              </button>
            </div>
          </div>

          {geoError ? <p className={styles.locationError}>{geoError}</p> : null}
          {!import.meta.env.VITE_GOOGLE_API_KEY ? (
            <p className={styles.locationTip}>
              Tip: Provide a Google Places API key to enable location search suggestions.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className={styles.formRow}>
        {showName ? (
          <div className={styles.searchField}>
            <Search className={styles.searchIcon} size={18} aria-hidden />
            <input
              type="text"
              placeholder="Search by player name"
              value={searchValue}
              onChange={(event) => handleNameChange(event.target.value)}
              aria-label="Search by player name"
            />
          </div>
        ) : null}

        <div className={styles.metaRow}>
          {resolvedUserName ? (
            <span className={styles.metaText}>
              <UserRound size={16} aria-hidden /> Signed in as {resolvedUserName}
            </span>
          ) : (
            <span className={styles.metaText}>Signed in player</span>
          )}
          <button type="button" className={styles.clearButton} onClick={handleClearFilters}>
            Clear filters
          </button>
        </div>
      </div>

      <div className={styles.filtersSection}>
        <div className={styles.filterChips}>
          {Object.entries(selectedFilters).map(([key, value]) => (
            <span key={key} className={styles.filterChip}>
              {key}: {Array.isArray(value) ? value.join(", ") : String(value)}
              <button
                type="button"
                className={styles.chipRemove}
                onClick={() => handleRemoveFilter(key)}
                aria-label={`Remove ${key} filter`}
              >
                <X size={14} aria-hidden />
              </button>
            </span>
          ))}
          {!Object.keys(selectedFilters).length ? <span>No additional filters</span> : null}
        </div>
        <form className={styles.addFilterForm} onSubmit={handleSubmitDynamicFilter}>
          <input
            type="text"
            placeholder="Filter key (e.g. handedness)"
            value={pendingKey}
            onChange={(event) => setPendingKey(event.target.value)}
            aria-label="Dynamic filter key"
          />
          <input
            type="text"
            placeholder="Value (e.g. left)"
            value={pendingValue}
            onChange={(event) => setPendingValue(event.target.value)}
            aria-label="Dynamic filter value"
          />
          <button type="submit" className={styles.submitFilterButton}>
            <Plus size={16} aria-hidden /> Add filter
          </button>
        </form>
      </div>
    </section>
  );
};

export default FilterMenu;
