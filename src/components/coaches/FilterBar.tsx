import { ChevronDown, MapPin, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { getGoogleMaps, loadGooglePlacesLibrary } from "../../lib/googlePlaces";

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

type LocationPrediction = {
  description: string;
  placeId: string;
};

export type LocationSelection = {
  label: string;
  placeId: string | null;
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
    placeId: null,
    coords: null,
    isCurrent: true,
  });
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [locationPredictions, setLocationPredictions] = useState<LocationPrediction[]>([]);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);

  const locationPickerRef = useRef<HTMLDivElement | null>(null);
  const autocompleteServiceRef = useRef<unknown>(null);

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
    setLocationPredictions([]);
  }, []);

  const resolveLocationFromPlaceId = useCallback(
    async (prediction: LocationPrediction, isCurrent: boolean) => {
      try {
        await loadGooglePlacesLibrary();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "We couldn't connect to Google Places. Try again.";
        updateSelectedLocation({
          label: prediction.description,
          placeId: prediction.placeId,
          coords: null,
          isCurrent,
        });
        setLocationError(message);
        setIsResolvingLocation(false);
        return;
      }

      const googleMaps = getGoogleMaps() as
        | (Record<string, unknown> & {
            Geocoder?: new () => {
              geocode: (
                request: { location?: { lat: number; lng: number }; placeId?: string },
                callback: (results: { formatted_address?: string; place_id?: string; geometry?: { location?: { lat: () => number; lng: () => number } } }[] | null, status: string) => void
              ) => void;
            };
            places?: { PlacesServiceStatus?: { OK?: string } };
          })
        | undefined;

      if (!googleMaps?.Geocoder) {
        updateSelectedLocation({
          label: prediction.description,
          placeId: prediction.placeId,
          coords: null,
          isCurrent,
        });
        setLocationError("Google Maps geocoding is unavailable right now.");
        setIsResolvingLocation(false);
        return;
      }

      const geocoder = new googleMaps.Geocoder();
      geocoder.geocode(
        { placeId: prediction.placeId },
        (results, status) => {
          const nextLocation: LocationSelection = {
            label: prediction.description,
            placeId: prediction.placeId,
            coords: null,
            isCurrent,
          };

          if (status === "OK" && results && results[0]) {
            const { formatted_address: formattedAddress, place_id: placeId, geometry } = results[0];
            const lat = geometry?.location?.lat?.();
            const lng = geometry?.location?.lng?.();

            nextLocation.label = formattedAddress ?? prediction.description;
            nextLocation.placeId = placeId ?? prediction.placeId;
            nextLocation.coords =
              typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;
            setLocationError(null);
          } else if (status !== "ZERO_RESULTS") {
            setLocationError("We couldn't verify that location. Try another search.");
          } else {
            setLocationError(null);
          }

          updateSelectedLocation(nextLocation);
          setIsResolvingLocation(false);
        }
      );
    },
    [updateSelectedLocation]
  );

  const resolveCurrentLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      updateSelectedLocation({
        label: "Current location",
        placeId: null,
        coords: null,
        isCurrent: true,
      });
      setLocationError("Geolocation isn't supported in your browser. Search to pick a location.");
      return;
    }

    setIsResolvingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          await loadGooglePlacesLibrary();
        } catch (error) {
          updateSelectedLocation({
            label: "Current location",
            placeId: null,
            coords: { lat: coords.latitude, lng: coords.longitude },
            isCurrent: true,
          });
          setLocationError(
            error instanceof Error
              ? error.message
              : "We couldn't connect to Google Places. Try again."
          );
          setIsResolvingLocation(false);
          return;
        }

        const googleMaps = getGoogleMaps() as
          | (Record<string, unknown> & {
              Geocoder?: new () => {
                geocode: (
                  request: { location?: { lat: number; lng: number }; placeId?: string },
                  callback: (results: { formatted_address?: string; place_id?: string; geometry?: { location?: { lat: () => number; lng: () => number } } }[] | null, status: string) => void
                ) => void;
              };
            })
          | undefined;

        if (!googleMaps?.Geocoder) {
          updateSelectedLocation({
            label: "Current location",
            placeId: null,
            coords: { lat: coords.latitude, lng: coords.longitude },
            isCurrent: true,
          });
          setLocationError("Google Maps geocoding is unavailable right now.");
          setIsResolvingLocation(false);
          return;
        }

        const geocoder = new googleMaps.Geocoder();
        geocoder.geocode(
          { location: { lat: coords.latitude, lng: coords.longitude } },
          (results, status) => {
            const nextLocation: LocationSelection = {
              label: "Current location",
              placeId: null,
              coords: { lat: coords.latitude, lng: coords.longitude },
              isCurrent: true,
            };

            if (status === "OK" && results && results[0]) {
              nextLocation.label = results[0].formatted_address ?? "Current location";
              nextLocation.placeId = results[0].place_id ?? null;
              setLocationError(null);
            } else if (status !== "ZERO_RESULTS") {
              setLocationError("We couldn't verify your location. Try searching manually.");
            } else {
              setLocationError(null);
            }

            updateSelectedLocation(nextLocation);
            setIsResolvingLocation(false);
          }
        );
      },
      (error) => {
        updateSelectedLocation({
          label: "Current location",
          placeId: null,
          coords: null,
          isCurrent: true,
        });

        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("Location access was denied. Search to choose a different location.");
        } else {
          setLocationError("We couldn't determine your location. Search to choose a different one.");
        }

        setIsResolvingLocation(false);
      }
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
    if (!isLocationPickerOpen || !locationInput.trim()) {
      if (!locationInput.trim()) {
        setLocationPredictions([]);
      }
      return undefined;
    }

    let isActive = true;

    const fetchPredictions = async () => {
      try {
        await loadGooglePlacesLibrary();
      } catch (error) {
        if (!isActive) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : "We couldn't connect to Google Places. Try again.";
        setLocationError(message);
        setLocationPredictions([]);
        return;
      }

      const googleMaps = getGoogleMaps() as
        | (Record<string, unknown> & {
            places?: {
              AutocompleteService?: new () => {
                getPlacePredictions: (
                  request: Record<string, unknown>,
                  callback: (predictions: { description: string; place_id: string }[] | null, status: string) => void
                ) => void;
              };
              PlacesServiceStatus?: { OK?: string; ZERO_RESULTS?: string };
            };
          })
        | undefined;

      const placesNamespace = googleMaps?.places;

      if (!placesNamespace?.AutocompleteService) {
        if (isActive) {
          setLocationError("Google Places suggestions are unavailable right now.");
          setLocationPredictions([]);
        }
        return;
      }

      if (!autocompleteServiceRef.current) {
        autocompleteServiceRef.current = new placesNamespace.AutocompleteService();
      }

      const request: Record<string, unknown> = {
        input: locationInput.trim(),
      };

      if (selectedLocation.coords) {
        request.locationBias = {
          lat: selectedLocation.coords.lat,
          lng: selectedLocation.coords.lng,
        };
      }

      (autocompleteServiceRef.current as {
        getPlacePredictions: (
          input: Record<string, unknown>,
          callback: (
            predictions: { description: string; place_id: string }[] | null,
            status: string
          ) => void
        ) => void;
      }).getPlacePredictions(request, (predictions, status) => {
        if (!isActive) {
          return;
        }

        const okStatus = placesNamespace.PlacesServiceStatus?.OK ?? "OK";
        const zeroStatus = placesNamespace.PlacesServiceStatus?.ZERO_RESULTS ?? "ZERO_RESULTS";

        if (status !== okStatus) {
          if (status === zeroStatus) {
            setLocationPredictions([]);
            setLocationError(null);
            return;
          }

          setLocationPredictions([]);
          setLocationError("We couldn't load suggestions. Try again in a moment.");
          return;
        }

        setLocationError(null);
        setLocationPredictions(
          predictions?.map((prediction) => ({
            description: prediction.description,
            placeId: prediction.place_id,
          })) ?? []
        );
      });
    };

    const timeoutId = window.setTimeout(fetchPredictions, 220);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [isLocationPickerOpen, locationInput, selectedLocation.coords]);

  const handleLocationButtonClick = () => {
    setIsLocationPickerOpen((previous) => !previous);
    setLocationError(null);
  };

  const handleSelectPrediction = (prediction: LocationPrediction) => {
    setIsResolvingLocation(true);
    closeLocationPicker();
    resolveLocationFromPlaceId(prediction, false);
  };

  const handleUseCurrentLocation = () => {
    closeLocationPicker();
    resolveCurrentLocation();
  };

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
                  {locationPredictions.map((prediction) => (
                    <button
                      type="button"
                      key={prediction.placeId}
                      className="fc-location-popover__option"
                      onClick={() => handleSelectPrediction(prediction)}
                    >
                      {prediction.description}
                    </button>
                  ))}
                  {locationPredictions.length === 0 && !locationInput.trim() ? (
                    <p className="fc-location-popover__hint">Start typing to search for a new location.</p>
                  ) : null}
                  {locationPredictions.length === 0 && locationInput.trim() && !locationError ? (
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
