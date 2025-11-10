import { ChevronDown, MapPin, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { searchLocations, type LocationSuggestion } from "../../lib/locationSearch";

import "./coaches.css";

type FilterBarProps = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSearch: () => void;
  radiusOptions: string[];
  selectedRadius: string;
  onRadiusChange: (value: string) => void;
  onLocationChange?: (location: LocationSelection) => void;
};

type FilterSelect = {
  id: string;
  label: string;
  options: { value: string; label: string }[];
};

export type LocationSelection = {
  label: string;
  locationId: string | null;
  coords: { lat: number; lng: number } | null;
  isCurrent: boolean;
};

const filterSelects: FilterSelect[] = [
  {
    id: "price",
    label: "Filter by price",
    options: [
      { value: "all", label: "All Prices" },
      { value: "0-50", label: "$0 - $50" },
      { value: "50-100", label: "$50 - $100" },
      { value: "100-plus", label: "$100+" },
    ],
  },
  {
    id: "specialty",
    label: "Filter by specialty",
    options: [
      { value: "all", label: "All Specialties" },
      { value: "hitting", label: "Hitting" },
      { value: "pitching", label: "Pitching" },
      { value: "strength", label: "Strength & Conditioning" },
      { value: "mental", label: "Mental Performance" },
    ],
  },
];

const FilterBar = ({
  searchTerm,
  onSearchTermChange,
  onSearch,
  radiusOptions,
  selectedRadius,
  onRadiusChange,
  onLocationChange,
}: FilterBarProps) => {
  const [selectedLocation, setSelectedLocation] = useState<LocationSelection>({
    label: "Detecting location…",
    locationId: null,
    coords: null,
    isCurrent: true,
  });
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);

  const locationPickerRef = useRef<HTMLDivElement | null>(null);

  const updateSelectedLocation = useCallback(
    (nextLocation: LocationSelection) => {
      setSelectedLocation(nextLocation);
      onLocationChange?.(nextLocation);
    },
    [onLocationChange]
  );

  const closeLocationPicker = useCallback(() => {
    setIsLocationPickerOpen(false);
    setLocationInput("");
    setLocationSuggestions([]);
    setIsFetchingSuggestions(false);
  }, []);

  const resolveCurrentLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      updateSelectedLocation({
        label: "Current location",
        locationId: null,
        coords: null,
        isCurrent: true,
      });
      setLocationError("Geolocation isn't supported in your browser. Search to pick a location.");
      return;
    }

    setIsResolvingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        updateSelectedLocation({
          label: "Current location",
          locationId: null,
          coords: { lat: coords.latitude, lng: coords.longitude },
          isCurrent: true,
        });
        setIsResolvingLocation(false);
      },
      (error) => {
        updateSelectedLocation({
          label: "Current location",
          locationId: null,
          coords: null,
          isCurrent: true,
        });

        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("Location access was denied. Search to choose a different location.");
        } else {
          setLocationError("We couldn't determine your location. Search to choose a different one.");
        }

        setIsResolvingLocation(false);
      },
      { enableHighAccuracy: true, maximumAge: 1000 * 60 * 5, timeout: 1000 * 20 }
    );
  }, [updateSelectedLocation]);

  useEffect(() => {
    resolveCurrentLocation();
  }, [resolveCurrentLocation]);

  useEffect(() => {
    if (!isLocationPickerOpen) {
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!locationPickerRef.current) {
        return;
      }

      if (!locationPickerRef.current.contains(event.target as Node)) {
        closeLocationPicker();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLocationPicker();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeLocationPicker, isLocationPickerOpen]);

  useEffect(() => {
    if (!isLocationPickerOpen) {
      return undefined;
    }

    const trimmed = locationInput.trim();

    if (trimmed.length < 3) {
      setLocationSuggestions([]);
      setIsFetchingSuggestions(false);
      return undefined;
    }

    let isActive = true;
    const controller = new AbortController();
    setIsFetchingSuggestions(true);

    const fetchSuggestions = async () => {
      try {
        const suggestions = await searchLocations({
          search: trimmed,
          limit: 6,
          signal: controller.signal,
        });

        if (!isActive) {
          return;
        }

        setLocationSuggestions(suggestions);
        setLocationError(null);
      } catch (error) {
        if (!isActive || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }

        setLocationSuggestions([]);
        setLocationError("We couldn't load locations. Try again in a moment.");
      } finally {
        if (isActive) {
          setIsFetchingSuggestions(false);
        }
      }
    };

    const timeoutId = window.setTimeout(fetchSuggestions, 220);

    return () => {
      isActive = false;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [isLocationPickerOpen, locationInput]);

  const handleLocationButtonClick = () => {
    setIsLocationPickerOpen((previous) => !previous);
    setLocationError(null);
  };

  const handleSelectSuggestion = (suggestion: LocationSuggestion) => {
    closeLocationPicker();
    updateSelectedLocation({
      label: suggestion.label,
      locationId: suggestion.id,
      coords: suggestion.coords,
      isCurrent: false,
    });
    setLocationError(null);
  };

  const handleUseCurrentLocation = () => {
    closeLocationPicker();
    setLocationError(null);
    resolveCurrentLocation();
  };

  const trimmedLocationInput = locationInput.trim();

  const locationButtonLabel = useMemo(() => {
    if (isResolvingLocation && selectedLocation.isCurrent) {
      return "Updating location…";
    }

    if (selectedLocation.label.trim().length === 0) {
      return "Set location";
    }

    return selectedLocation.label;
  }, [isResolvingLocation, selectedLocation.label, selectedLocation.isCurrent]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch();
  };

  return (
    <div className="fc-filter">
      <div className="fc-filter__distance-row">
        <div className="fc-filter__distance-group">
          <div className="fc-location-picker" ref={locationPickerRef}>
            <button
              type="button"
              className="fc-distance-chip fc-distance-chip--location"
              aria-label="Selected location"
              onClick={handleLocationButtonClick}
            >
              <MapPin size={18} />
              <span className="fc-location-picker__label">{locationButtonLabel}</span>
            </button>
            {isLocationPickerOpen ? (
              <div className="fc-location-popover" role="dialog" aria-label="Choose a location">
                <div className="fc-location-popover__search">
                  <input
                    autoFocus
                    value={locationInput}
                    onChange={(event) => setLocationInput(event.target.value)}
                    placeholder="Search for a city, club, or venue"
                    aria-label="Search for a location"
                  />
                </div>
                <button
                  type="button"
                  className="fc-location-popover__current"
                  onClick={handleUseCurrentLocation}
                >
                  Use current location
                </button>
                <div className="fc-location-popover__options" role="listbox">
                  {locationSuggestions.map((suggestion) => (
                    <button
                      type="button"
                      key={suggestion.id}
                      className="fc-location-popover__option"
                      onClick={() => handleSelectSuggestion(suggestion)}
                    >
                      {suggestion.label}
                    </button>
                  ))}
                  {isFetchingSuggestions ? (
                    <p className="fc-location-popover__hint">Searching for locations…</p>
                  ) : null}
                  {locationSuggestions.length === 0 && !isFetchingSuggestions && trimmedLocationInput.length < 3 ? (
                    <p className="fc-location-popover__hint">Enter at least 3 characters to search.</p>
                  ) : null}
                  {locationSuggestions.length === 0 && trimmedLocationInput.length >= 3 && !isFetchingSuggestions && !locationError ? (
                    <p className="fc-location-popover__hint">No matches yet. Try a different search.</p>
                  ) : null}
                </div>
                {isResolvingLocation ? (
                  <p className="fc-location-popover__status">Updating location…</p>
                ) : null}
                {locationError ? (
                  <p className="fc-location-popover__error" role="status">
                    {locationError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          {radiusOptions.map((radius) => (
            <button
              key={radius}
              type="button"
              className={`fc-distance-chip${selectedRadius === radius ? " fc-distance-chip--active" : ""}`}
              onClick={() => onRadiusChange(radius)}
            >
              {radius}
            </button>
          ))}
        </div>
      </div>

      <form className="fc-filter__form" onSubmit={handleSubmit}>
        <div className="fc-filter__search">
          <Search className="fc-filter__search-icon" size={18} strokeWidth={2} />
          <input
            aria-label="Search coaches"
            placeholder="Search coaches..."
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
          />
        </div>
        <div className="fc-filter__selects">
          {filterSelects.map(({ id, label, options }) => (
            <div key={id} className="fc-select">
              <select aria-label={label} defaultValue={options[0].value} className="fc-select__field">
                {options.map(({ value, label: optionLabel }) => (
                  <option key={value} value={value}>
                    {optionLabel}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="fc-select__icon" aria-hidden="true" />
            </div>
          ))}
        </div>
      </form>
    </div>
  );
};

export default FilterBar;
