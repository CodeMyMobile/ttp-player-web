import { useEffect, useRef, useState } from "react";
import Autocomplete from "react-google-autocomplete";
import { getReverseCodeLocation } from "../../api/locations";

const hasCoordinates = (value) =>
  value &&
  typeof value.latitude === "number" &&
  !Number.isNaN(value.latitude) &&
  typeof value.longitude === "number" &&
  !Number.isNaN(value.longitude);

const normalizePlaceResult = (place) => {
  const latitude = place?.geometry?.location?.lat?.();
  const longitude = place?.geometry?.location?.lng?.();

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  return {
    formattedAddress: place.formatted_address || place.name || "",
    geometry: {
      location: {
        lat: latitude,
        lng: longitude,
      },
    },
  };
};

const toAddressText = (value) =>
  value?.formattedAddress || value?.address || "";

const AddressPicker = ({ onSelect, latitude = 0, longitude = 0, userPos, initialAddress = null }) => {
  const autocompleteRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  const [inputValue, setInputValue] = useState(
    toAddressText(initialAddress),
  );
  const didAutofillFromLocation = useRef(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const initialText = toAddressText(initialAddress);
    if (initialText && initialText !== inputValue) {
      setInputValue(initialText);
    }
  }, [initialAddress, inputValue]);

  useEffect(() => {
    const target =
      hasCoordinates(userPos) && latitude === 0 && longitude === 0
        ? userPos
        : hasCoordinates({ latitude, longitude })
          ? { latitude, longitude }
          : null;

    if (!target || didAutofillFromLocation.current) return;
    let isMounted = true;

    const fetchReverseGeocode = async () => {
      try {
        setInputValue("Enter location");
        const response = await getReverseCodeLocation(target.latitude, target.longitude);
        if (!response.ok) {
          if (isMounted) setInputValue("Error");
          return;
        }
        const payload = await response.json();
        const result = payload?.results?.[0];
        if (!result || !isMounted) return;
        didAutofillFromLocation.current = true;
        const nextValue = result.formatted_address || "";
        setInputValue(nextValue);
        onSelectRef.current?.({
          formattedAddress: nextValue,
          geometry: {
            location: {
              lat: result.geometry?.location?.lat ?? target.latitude,
              lng: result.geometry?.location?.lng ?? target.longitude,
            },
          },
          raw: result,
        });
      } catch {
        if (isMounted) setInputValue("Error");
      }
    };

    fetchReverseGeocode();

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude, userPos?.latitude, userPos?.longitude]);

  return (
    <div className="simple-survey-address-picker">
      <Autocomplete
        ref={autocompleteRef}
        apiKey={import.meta.env.VITE_GOOGLE_API_KEY || undefined}
        placeholder="Enter your location"
        className="simple-survey__field"
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        onPlaceSelected={(place) => {
          const normalized = normalizePlaceResult(place);
          if (!normalized) return;
          setInputValue(normalized.formattedAddress);
          onSelectRef.current?.(normalized);
        }}
        options={{
          fields: ["formatted_address", "geometry", "name"],
          types: ["geocode", "establishment"],
        }}
      />
    </div>
  );
};

export default AddressPicker;
