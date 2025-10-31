import { Filter, LocateFixed, Search, Sparkles } from "lucide-react";
import type { FormEvent } from "react";

import "./coaches.css";

type FilterBarProps = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSearch: () => void;
  distances: string[];
  selectedDistance: string;
  onDistanceChange: (value: string) => void;
  specialties: string[];
  selectedSpecialties: string[];
  onToggleSpecialty: (value: string) => void;
};

const FilterBar = ({
  searchTerm,
  onSearchTermChange,
  onSearch,
  distances,
  selectedDistance,
  onDistanceChange,
  specialties,
  selectedSpecialties,
  onToggleSpecialty,
}: FilterBarProps) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch();
  };

  return (
    <div className="filter-bar">
      <form className="filter-bar__row" onSubmit={handleSubmit}>
        <div className="filter-bar__search">
          <Search className="filter-bar__search-icon" strokeWidth={2} />
          <input
            aria-label="Search coaches"
            placeholder="Search coaches, focus areas, certifications"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
          />
          <button type="submit" className="filter-bar__search-submit">
            Search
          </button>
        </div>
        <div className="filter-chip-group">
          {specialties.slice(0, 3).map((specialty) => {
            const isActive = selectedSpecialties.includes(specialty);
            return (
              <button
                key={specialty}
                type="button"
                className={`filter-chip${isActive ? " filter-chip--active" : ""}`}
                onClick={() => onToggleSpecialty(specialty)}
              >
                {specialty === "Top rated" ? (
                  <Sparkles className="filter-chip__icon" strokeWidth={2} />
                ) : (
                  <Filter className="filter-chip__icon" strokeWidth={2} />
                )}
                {specialty}
              </button>
            );
          })}
        </div>
      </form>
      <div className="filter-bar__row">
        <div className="filter-chip-group">
          {distances.map((distance) => (
            <button
              key={distance}
              type="button"
              className={`filter-chip${selectedDistance === distance ? " filter-chip--active" : ""}`}
              onClick={() => onDistanceChange(distance)}
            >
              <LocateFixed className="filter-chip__icon" strokeWidth={2} />
              {distance}
            </button>
          ))}
        </div>
        <div className="filter-chip-group">
          {specialties.slice(3).map((specialty) => {
            const isActive = selectedSpecialties.includes(specialty);
            return (
              <button
                key={specialty}
                type="button"
                className={`filter-chip${isActive ? " filter-chip--active" : ""}`}
                onClick={() => onToggleSpecialty(specialty)}
              >
                {specialty === "Top rated" ? (
                  <Sparkles className="filter-chip__icon" strokeWidth={2} />
                ) : (
                  <Filter className="filter-chip__icon" strokeWidth={2} />
                )}
                {specialty}
              </button>
            );
          })}
          <button type="button" className="filter-chip">
            <Filter className="filter-chip__icon" strokeWidth={2} />
            More filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
