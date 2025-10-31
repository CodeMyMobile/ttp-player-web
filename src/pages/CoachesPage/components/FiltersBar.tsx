import { MapPin, SlidersHorizontal } from "lucide-react";
import { useId } from "react";
import type { SortOption } from "../types";
import SearchInput from "./SearchInput";
import SortDropdown from "./SortDropdown";

interface FiltersBarProps {
  locations: string[];
  selectedLocation: string;
  onLocationChange: (location: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  sortValue: SortOption;
  onSortChange: (value: SortOption) => void;
  onOpenFilters: () => void;
  hasActiveFilters: boolean;
}

const FiltersBar = ({
  locations,
  selectedLocation,
  onLocationChange,
  searchValue,
  onSearchChange,
  sortValue,
  onSortChange,
  onOpenFilters,
  hasActiveFilters,
}: FiltersBarProps) => {
  const locationSelectId = useId();

  return (
    <div className="filters-bar">
      <div className="filters-bar__location">
        <MapPin aria-hidden size={18} />
        <label className="sr-only" htmlFor={locationSelectId}>
          Filter by location
        </label>
        <select
          id={locationSelectId}
          value={selectedLocation}
          onChange={(event) => onLocationChange(event.target.value)}
        >
          {locations.map((location) => (
            <option key={location} value={location}>
              {location}
            </option>
          ))}
        </select>
      </div>
      <SearchInput
        value={searchValue}
        onChange={onSearchChange}
        placeholder="Search by coach or specialty"
      />
      <SortDropdown
        value={sortValue}
        onChange={onSortChange}
        options={[
          { value: "recommended", label: "Recommended" },
          { value: "highest-rated", label: "Highest Rated" },
          { value: "lowest-rate", label: "Lowest Rate" },
          { value: "highest-rate", label: "Highest Rate" },
        ]}
      />
      <button
        type="button"
        className="filters-bar__filters-button"
        onClick={onOpenFilters}
        aria-pressed={hasActiveFilters}
      >
        <SlidersHorizontal aria-hidden size={18} />
        Filters{hasActiveFilters ? " •" : ""}
        {hasActiveFilters ? <span className="filters-bar__filters-indicator" aria-hidden /> : null}
      </button>
    </div>
  );
};

export default FiltersBar;
