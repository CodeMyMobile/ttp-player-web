import { ChevronDown, MapPin, Search } from "lucide-react";
import type { FormEvent } from "react";

import "./coaches.css";

type FilterBarProps = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSearch: () => void;
  locationLabel: string;
  onLocationClick: () => void;
  isLocationPickerOpen: boolean;
  radiusOptions: string[];
  selectedRadius: string;
  onRadiusChange: (value: string) => void;
};

type FilterSelect = {
  id: string;
  label: string;
  options: { value: string; label: string }[];
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
  locationLabel,
  onLocationClick,
  isLocationPickerOpen,
  radiusOptions,
  selectedRadius,
  onRadiusChange,
}: FilterBarProps) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch();
  };

  return (
    <div className="fc-filter">
      <div className="fc-filter__distance-row">
        <div className="fc-filter__distance-group">
          <button
            type="button"
            className={`fc-distance-chip fc-distance-chip--location${
              isLocationPickerOpen ? " fc-distance-chip--active" : ""
            }`}
            aria-label={locationLabel ? `Selected location: ${locationLabel}` : "Select location"}
            aria-expanded={isLocationPickerOpen}
            aria-controls="coach-location-picker"
            onClick={onLocationClick}
          >
            <MapPin size={18} />
            {locationLabel || "Select location"}
          </button>
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
