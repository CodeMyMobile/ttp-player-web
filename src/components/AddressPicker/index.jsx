import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import Autocomplete from "react-google-autocomplete";

import { getReverseCodeLocation } from "../../api/locations";
import "./styles.css";

const AddressPicker = ({ onSelect, latitude = 0, longitude = 0, userPos }) => {
  const onSelectRef = useRef(onSelect);
  const initialLoadRef = useRef(true);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let isMounted = true;

    const handlePlaceSelect = async (nextLatitude, nextLongitude) => {
      try {
        if (!nextLatitude || !nextLongitude) return;
        setInputValue("Fetching location");
        const response = await getReverseCodeLocation(nextLatitude, nextLongitude);
        if (!response.ok) {
          if (isMounted) setInputValue("Error");
          return;
        }

        const locationData = await response.json();
        const result = locationData?.results?.[0];
        if (!result || !isMounted) return;

        setInputValue(result.formatted_address || "");
        onSelectRef.current?.(result);
      } catch {
        if (isMounted) setInputValue("Error");
      }
    };

    if (
      initialLoadRef.current &&
      userPos?.latitude &&
      userPos?.longitude &&
      latitude === 0 &&
      longitude === 0
    ) {
      initialLoadRef.current = false;
      handlePlaceSelect(userPos.latitude, userPos.longitude);
    }

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude, userPos?.latitude, userPos?.longitude]);

  return (
    <div className="address-picker">
      <Autocomplete
        apiKey={import.meta.env.VITE_GOOGLE_API_KEY || undefined}
        placeholder="Enter your location"
        className="address-picker__input"
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        onPlaceSelected={(place) => {
          if (!place) return;
          const latitudeValue = place.geometry?.location?.lat?.();
          const longitudeValue = place.geometry?.location?.lng?.();
          if (typeof latitudeValue !== "number" || typeof longitudeValue !== "number") return;

          const details = {
            formatted_address: place.formatted_address || place.name || "",
            address_components: place.address_components || [],
            geometry: {
              location: {
                lat: latitudeValue,
                lng: longitudeValue,
              },
            },
            name: place.name || "",
          };
          setInputValue(details.formatted_address);
          onSelectRef.current?.(details);
        }}
        options={{
          fields: ["formatted_address", "geometry", "name", "address_components"],
          types: ["geocode", "establishment"],
        }}
      />
    </div>
  );
};

AddressPicker.propTypes = {
  onSelect: PropTypes.func,
  latitude: PropTypes.number,
  longitude: PropTypes.number,
  userPos: PropTypes.shape({
    latitude: PropTypes.number,
    longitude: PropTypes.number,
  }),
};

export default AddressPicker;
