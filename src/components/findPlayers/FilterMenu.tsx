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
  const [draftLocation, setDraftLocation] = useState(selectedLocation?.label ?? "");
  const [pendingKey, setPendingKey] = useState("");
  const [pendingValue, setPendingValue] = useState("");

  useEffect(() => {
    setDraftLocation(selectedLocation?.label ?? "");
  }, [selectedLocation]);

  const resolvedUserName = useMemo(() => {
    if (!user) return "";
    if (typeof user.name === "string" && user.name.trim()) {
      return user.name;
    }
    return "";
  }, [user]);

  const handleUseCurrentLocation = useCallback(() => {
    if (!userPos) return;
    const location: SelectedLocation = {
      label: "Current location",
      latitude: userPos.latitude,
      longitude: userPos.longitude,
      isCurrentLocation: true,
    };
    // eslint-disable-next-line no-console
    console.log("Filter change", { type: "location", location });
    onFilterChange({ type: "location", location });
    setDraftLocation(location.label);
  }, [onFilterChange, userPos]);

  const handleLocationBlur = useCallback(() => {
    const trimmed = draftLocation.trim();
    if (!trimmed) {
      // eslint-disable-next-line no-console
      console.log("Filter change", { type: "location", location: null });
      onFilterChange({ type: "location", location: null });
      return;
    }
    const location: SelectedLocation = { label: trimmed };
    // eslint-disable-next-line no-console
    console.log("Filter change", { type: "location", location });
    onFilterChange({ type: "location", location });
  }, [draftLocation, onFilterChange]);

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
    setDraftLocation("");
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
            value={draftLocation}
            onChange={(event) => setDraftLocation(event.target.value)}
            onBlur={handleLocationBlur}
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
