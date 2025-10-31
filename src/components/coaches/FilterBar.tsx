import { ChevronDown, MapPin, Search } from "lucide-react";
import type { FormEvent } from "react";

import "./coaches.css";

type FilterBarProps = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSearch: () => void;
  radiusOptions: string[];
  selectedRadius: string;
  onRadiusChange: (value: string) => void;
};

const filterSelectOptions = ["All Ratings", "All Prices", "All Specialties"];

const FilterBar = ({
  searchTerm,
  onSearchTermChange,
  onSearch,
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
          <button type="button" className="fc-distance-chip fc-distance-chip--location" aria-label="Current location">
            <MapPin size={18} />
            Current location
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
          {filterSelectOptions.map((option) => (
            <button key={option} type="button" className="fc-select">
              {option}
              <ChevronDown size={16} />
            </button>
          ))}
        </div>
      </form>
    </div>
  );
};

export default FilterBar;
