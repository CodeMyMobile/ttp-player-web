import { useEffect, useMemo, useRef, useState } from "react";
import Autocomplete from "react-google-autocomplete";

const createCourtId = () =>
  `court-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const getCourtKey = (court) => {
  const lat = court?.geometry?.location?.lat;
  const lng = court?.geometry?.location?.lng;
  return `${court?.formattedAddress || ""}-${lat || ""}-${lng || ""}`;
};

const withCourtId = (court) =>
  court && typeof court === "object"
    ? { ...court, __id: court.__id || createCourtId() }
    : court;

const normalizeCourtList = (courts = []) => courts.map(withCourtId);

const areCourtListsEqual = (left = [], right = []) => {
  if (left.length !== right.length) return false;
  return left.every((court, index) => getCourtKey(court) === getCourtKey(right[index]));
};

const normalizeCourtPlace = (place) => {
  const latitude = place?.geometry?.location?.lat?.();
  const longitude = place?.geometry?.location?.lng?.();

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  return {
    formattedAddress: place.name || place.formatted_address || "",
    geometry: {
      location: {
        lat: latitude,
        lng: longitude,
      },
    },
  };
};

const TennisCourtPicker = ({
  onSelect,
  latitude = 0,
  longitude = 0,
  initialSelectedCourts = [],
}) => {
  const [selectedCourts, setSelectedCourts] = useState(() =>
    normalizeCourtList(initialSelectedCourts || []),
  );
  const [searchValue, setSearchValue] = useState("");
  const lastEmittedValueRef = useRef("");

  useEffect(() => {
    const normalizedInitialCourts = normalizeCourtList(initialSelectedCourts || []);
    setSelectedCourts((current) =>
      areCourtListsEqual(current, normalizedInitialCourts) ? current : normalizedInitialCourts,
    );
  }, [initialSelectedCourts]);

  useEffect(() => {
    const nextSerializedValue = JSON.stringify(
      selectedCourts.map((court) => ({
        formattedAddress: court.formattedAddress,
        geometry: court.geometry,
      })),
    );
    if (nextSerializedValue === lastEmittedValueRef.current) return;
    lastEmittedValueRef.current = nextSerializedValue;
    onSelect?.(selectedCourts);
  }, [onSelect, selectedCourts]);

  const selectedCourtKeys = useMemo(
    () => new Set(selectedCourts.map((court) => getCourtKey(court))),
    [selectedCourts],
  );

  const autocompleteOptions = useMemo(() => {
    const base = {
      fields: ["formatted_address", "geometry", "name"],
      types: ["establishment"],
    };

    if (
      latitude &&
      longitude &&
      window.google?.maps?.LatLng
    ) {
      return {
        ...base,
        location: new window.google.maps.LatLng(latitude, longitude),
        radius: 10000,
      };
    }

    return base;
  }, [latitude, longitude]);

  const toggleCourt = (court) => {
    const nextCourt = withCourtId(court);
    const courtKey = getCourtKey(court);
    setSelectedCourts((current) =>
      selectedCourtKeys.has(courtKey)
        ? current.filter((entry) => getCourtKey(entry) !== courtKey)
        : [...current, nextCourt],
    );
  };

  return (
    <div className="simple-survey-courts">
      <Autocomplete
        apiKey={import.meta.env.VITE_GOOGLE_API_KEY || undefined}
        placeholder="Search for tennis courts"
        className="simple-survey__field"
        value={searchValue}
        onChange={(event) => setSearchValue(event.target.value)}
        onPlaceSelected={(place) => {
          const normalized = normalizeCourtPlace(place);
          if (!normalized) return;
          toggleCourt(normalized);
          setSearchValue("");
        }}
        options={autocompleteOptions}
      />

      <div className="simple-survey-courts__summary">
        <span>Selected courts ({selectedCourts.length})</span>
      </div>

      <div className="simple-survey-courts__list">
        {selectedCourts.length > 0 ? (
          selectedCourts.map((court, index) => (
            <div key={court.__id || `${getCourtKey(court)}-${index}`} className="simple-survey-courts__item">
              <span className="simple-survey-courts__item-label">
                {index + 1}. {court.formattedAddress}
              </span>
              <button
                type="button"
                className="simple-survey-courts__remove"
                onClick={() => toggleCourt(court)}
              >
                Remove
              </button>
            </div>
          ))
        ) : (
          <p className="simple-survey-courts__empty">No courts selected.</p>
        )}
      </div>
    </div>
  );
};

export default TennisCourtPicker;
