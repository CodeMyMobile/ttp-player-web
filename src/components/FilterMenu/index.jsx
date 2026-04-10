import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";

import { getDynamicFilters } from "../../api/player";
import AddressPicker from "../AddressPicker";
import SliderWithBubble from "../SliderWithBubble";
import "./styles.css";

const normalizeFilters = (payload) => {
  if (!Array.isArray(payload) || payload.length === 0) return [];
  const allowed = payload[0]?.filter_json?.allowedFilters;
  if (!Array.isArray(allowed)) return [];
  return allowed.filter((filter) => filter?.status);
};

const getAddressComponent = (details, type) =>
  details?.address_components?.find?.((component) => component.types?.includes?.(type));

const buildShortLocationLabel = (details) => {
  const placeName = details?.name?.trim?.() || "";
  const neighborhood =
    getAddressComponent(details, "neighborhood")?.long_name ||
    getAddressComponent(details, "sublocality")?.long_name ||
    getAddressComponent(details, "locality")?.long_name ||
    "";

  if (placeName && neighborhood && !placeName.toLowerCase().includes(neighborhood.toLowerCase())) {
    return `${placeName}, ${neighborhood}`;
  }

  if (placeName) {
    return placeName;
  }

  if (neighborhood) {
    return neighborhood;
  }

  const formattedAddress = details?.formatted_address || "";
  return formattedAddress
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
};

const CustomCheckBox = ({ value, onValueChange, label }) => (
  <button
    type="button"
    className="filter-menu__checkbox"
    onClick={() => onValueChange(!value)}
  >
    <span className={`filter-menu__checkbox-box${value ? " is-checked" : ""}`}>
      {value ? <span className="filter-menu__checkbox-tick" /> : null}
    </span>
    <span>{label}</span>
  </button>
);

CustomCheckBox.propTypes = {
  value: PropTypes.bool.isRequired,
  onValueChange: PropTypes.func.isRequired,
  label: PropTypes.string.isRequired,
};

const FilterMenu = ({
  onFilterChange,
  userPos,
  showName = false,
  radius = 10,
  onRadiusChange,
  isCoachSearch = false,
  token,
  compact = false,
}) => {
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);
  const [filtersData, setFiltersData] = useState([]);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [localRadius, setLocalRadius] = useState(radius);
  const [location, setLocation] = useState({ lat: userPos?.latitude || 0, lng: userPos?.longitude || 0 });
  const [name, setName] = useState("");

  useEffect(() => {
    setLocalRadius(radius);
  }, [radius]);

  useEffect(() => {
    setLocation({ lat: userPos?.latitude || 0, lng: userPos?.longitude || 0 });
  }, [userPos?.latitude, userPos?.longitude]);

  useEffect(() => {
    const fetchFilters = async () => {
      if (isCoachSearch || !token) {
        setLoadingFilters(false);
        return;
      }

      try {
        const response = await getDynamicFilters(token);
        setFiltersData(normalizeFilters(response));
      } catch {
        setFiltersData([]);
      } finally {
        setLoadingFilters(false);
      }
    };

    fetchFilters();
  }, [isCoachSearch, token]);

  const pills = useMemo(
    () => [
      ...filtersData,
      { filterType: "Address", filterName: selectedLocation || "Location" },
      { filterType: "Radius", filterName: `${localRadius} Miles` },
      ...(showName ? [{ filterType: "Name", filterName: name || "Name" }] : []),
    ],
    [filtersData, localRadius, name, selectedLocation, showName],
  );

  const toggleFilterModal = (filter) => {
    setActiveFilter(filter);
    setFilterModalVisible(true);
  };

  const applyFilter = (questionId, value) => {
    setSelectedFilters((prev) => ({ ...prev, [questionId]: value }));
    onFilterChange?.({ type: "dynamic", questionId, value });
  };

  const handlePlaceSelection = (details) => {
    const formattedAddress = details?.formatted_address || "";
    const lat = details?.geometry?.location?.lat || 0;
    const lng = details?.geometry?.location?.lng || 0;
    const shortLabel = buildShortLocationLabel(details);

    setSelectedLocation(shortLabel || formattedAddress || "Location");
    setLocation({ lat, lng });
    onFilterChange?.({
      type: "location",
      value: {
        formatted_address: formattedAddress,
        short_label: shortLabel,
        lat,
        lng,
      },
    });
  };

  const applyNameFilter = () => {
    onFilterChange?.({ type: "name", value: name });
    setFilterModalVisible(false);
  };

  const clearFilters = () => {
    setSelectedFilters({});
    setSelectedLocation("");
    setLocalRadius(10);
    setName("");
    onFilterChange?.({ type: "clear" });
    setActiveFilter(null);
    setFilterModalVisible(false);
  };

  const openMenu = () => {
    setActiveFilter(null);
    setFilterModalVisible(true);
  };

  const closeMenu = () => {
    setActiveFilter(null);
    setFilterModalVisible(false);
  };

  const openFilterEditor = (filter) => {
    setActiveFilter(filter);
    setFilterModalVisible(true);
  };

  const summaryItems = [
    selectedLocation || "Location",
    `${localRadius} miles`,
    ...(showName && name ? [name] : []),
  ];

  return (
    <div className="filter-menu">
      {compact ? (
        <button type="button" className="filter-menu__trigger" onClick={openMenu} aria-label="Open filters">
          <span className="filter-menu__trigger-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="filter-menu__trigger-copy">
            <strong>Filters</strong>
            <small>{summaryItems.join(" · ")}</small>
          </span>
        </button>
      ) : (
        <div className="filter-menu__pills">
          {!loadingFilters &&
            pills.map((filter, index) => (
              <button
                key={filter.questionId || `${filter.filterType}-${index}`}
                type="button"
                onClick={() => toggleFilterModal(filter)}
                className={`filter-menu__pill${
                  filter.questionId && selectedFilters[filter.questionId] ? " is-active" : ""
                }`}
              >
                {filter.questionId && selectedFilters[filter.questionId]
                  ? Array.isArray(selectedFilters[filter.questionId])
                    ? selectedFilters[filter.questionId].join(", ")
                    : selectedFilters[filter.questionId]
                  : filter.filterName}
              </button>
            ))}
        </div>
      )}

      {filterModalVisible ? (
        <div className="filter-menu__overlay" onClick={closeMenu}>
          <div className="filter-menu__modal" onClick={(event) => event.stopPropagation()}>
            <div className="filter-menu__modal-head">
              <button type="button" onClick={clearFilters}>
                Clear All
              </button>
              <h3>{activeFilter ? `Filter ${activeFilter.filterName || ""}` : "Filters"}</h3>
              <button type="button" onClick={closeMenu}>
                Done
              </button>
            </div>

            <div className="filter-menu__modal-body">
              {!activeFilter ? (
                <div className="filter-menu__list">
                  {!loadingFilters &&
                    pills.map((filter, index) => {
                      const key = filter.questionId || `${filter.filterType}-${index}`;
                      const value =
                        filter.questionId && selectedFilters[filter.questionId]
                          ? Array.isArray(selectedFilters[filter.questionId])
                            ? selectedFilters[filter.questionId].join(", ")
                            : selectedFilters[filter.questionId]
                          : filter.filterName;

                      return (
                        <button
                          key={key}
                          type="button"
                          className="filter-menu__list-item"
                          onClick={() => openFilterEditor(filter)}
                        >
                          <span className="filter-menu__list-item-label">{filter.filterType}</span>
                          <span className="filter-menu__list-item-value">{value}</span>
                        </button>
                      );
                    })}
                </div>
              ) : null}

              {activeFilter?.filterType === "SelectionGroup" ? (
                <select
                  className="filter-menu__select"
                  value={selectedFilters[activeFilter.questionId] || ""}
                  onChange={(event) => applyFilter(activeFilter.questionId, event.target.value)}
                >
                  <option value="">Non Selected</option>
                  {(activeFilter.options || []).map((option, index) => (
                    <option key={`${option}-${index}`} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : null}

              {activeFilter?.filterType === "MultipleSelectionGroup" ? (
                <div className="filter-menu__checkboxes">
                  {(activeFilter.options || []).map((option, index) => {
                    const currentSelections = selectedFilters[activeFilter.questionId] || [];
                    const isSelected = currentSelections.includes(option);
                    return (
                      <CustomCheckBox
                        key={`${option}-${index}`}
                        value={isSelected}
                        label={option}
                        onValueChange={(newValue) => {
                          let nextSelections = currentSelections;
                          if (newValue) {
                            nextSelections = [...currentSelections, option];
                          } else {
                            nextSelections = currentSelections.filter((item) => item !== option);
                          }
                          applyFilter(activeFilter.questionId, nextSelections);
                        }}
                      />
                    );
                  })}
                </div>
              ) : null}

              {activeFilter?.filterType === "Address" ? (
                <>
                  <label className="filter-menu__label">Address</label>
                  <AddressPicker
                    onSelect={handlePlaceSelection}
                    latitude={location.lat}
                    longitude={location.lng}
                    userPos={userPos}
                  />
                </>
              ) : null}

              {activeFilter?.filterType === "Radius" ? (
                <>
                  <label className="filter-menu__label">Radius</label>
                  <SliderWithBubble
                    value={localRadius}
                    minimumValue={0}
                    maximumValue={100}
                    step={1}
                    onValueChange={setLocalRadius}
                    onSlidingComplete={(value) => {
                      setLocalRadius(value);
                      onRadiusChange?.(value);
                    }}
                  />
                </>
              ) : null}

              {activeFilter?.filterType === "Name" ? (
                <>
                  <label className="filter-menu__label">Search by Name</label>
                  <input
                    className="filter-menu__input"
                    placeholder="Enter name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                  <button type="button" className="filter-menu__apply" onClick={applyNameFilter}>
                    Apply
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

FilterMenu.propTypes = {
  onFilterChange: PropTypes.func,
  userPos: PropTypes.shape({
    latitude: PropTypes.number,
    longitude: PropTypes.number,
  }),
  showName: PropTypes.bool,
  radius: PropTypes.number,
  onRadiusChange: PropTypes.func,
  isCoachSearch: PropTypes.bool,
  token: PropTypes.string,
  compact: PropTypes.bool,
};

export default FilterMenu;
