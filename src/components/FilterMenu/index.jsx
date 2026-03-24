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
    const zipCodeComponent = details?.address_components?.find?.((component) =>
      component.types?.includes?.("postal_code"),
    );
    const zipCode = zipCodeComponent?.short_name || "";

    setSelectedLocation(zipCode || formattedAddress || "Location Not Found");
    setLocation({ lat, lng });
    onFilterChange?.({ type: "location", value: { formatted_address: formattedAddress, lat, lng } });
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
    setFilterModalVisible(false);
  };

  return (
    <div className="filter-menu">
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

      {filterModalVisible && activeFilter ? (
        <div className="filter-menu__overlay" onClick={() => setFilterModalVisible(false)}>
          <div className="filter-menu__modal" onClick={(event) => event.stopPropagation()}>
            <div className="filter-menu__modal-head">
              <button type="button" onClick={clearFilters}>
                Clear All
              </button>
              <h3>Filter {activeFilter.filterName || ""}</h3>
              <button type="button" onClick={() => setFilterModalVisible(false)}>
                Done
              </button>
            </div>

            <div className="filter-menu__modal-body">
              {activeFilter.filterType === "SelectionGroup" ? (
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

              {activeFilter.filterType === "MultipleSelectionGroup" ? (
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

              {activeFilter.filterType === "Address" ? (
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

              {activeFilter.filterType === "Radius" ? (
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

              {activeFilter.filterType === "Name" ? (
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
};

export default FilterMenu;
