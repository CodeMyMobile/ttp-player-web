import { ChevronDown, MapPin, Search } from "lucide-react";
import type { FormEvent } from "react";

import "../coaches/coaches.css";

type GroupLessonsFilterBarProps = {
  coachOptions: string[];
  selectedCoach: string;
  onCoachChange: (value: string) => void;
  levelOptions: string[];
  selectedLevel: string;
  onLevelChange: (value: string) => void;
  location: string;
  onLocationClick: () => void;
  useLocationFilter: boolean;
  onUseLocationFilterChange: (value: boolean) => void;
  radiusOptions: string[];
  selectedRadius: string;
  onRadiusChange: (value: string) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSearch: () => void;
};

const GroupLessonsFilterBar = ({
  coachOptions,
  selectedCoach,
  onCoachChange,
  levelOptions,
  selectedLevel,
  onLevelChange,
  location,
  onLocationClick,
  useLocationFilter,
  onUseLocationFilterChange,
  radiusOptions,
  selectedRadius,
  onRadiusChange,
  searchTerm,
  onSearchTermChange,
  onSearch,
}: GroupLessonsFilterBarProps) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch();
  };

  return (
    <div className="fc-filter group-lessons-filter">
      <div className="fc-filter__distance-row">
        <div className="fc-filter__distance-group">
          <label className="fc-distance-chip group-lessons-filter__toggle">
            <input
              type="checkbox"
              checked={useLocationFilter}
              onChange={(event) => onUseLocationFilterChange(event.target.checked)}
            />
            <span>Search near me</span>
          </label>
          <button
            type="button"
            className="fc-distance-chip fc-distance-chip--location group-lessons-filter__location"
            aria-label={`Current location: ${location}. Click to change location.`}
            title={location}
            onClick={onLocationClick}
            disabled={!useLocationFilter}
          >
            <MapPin size={18} />
            {location}
          </button>
          {radiusOptions.map((radius) => (
            <button
              key={radius}
              type="button"
              className={`fc-distance-chip${selectedRadius === radius ? " fc-distance-chip--active" : ""}`}
              onClick={() => onRadiusChange(radius)}
              disabled={!useLocationFilter}
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
            aria-label="Search group lessons"
            placeholder="Search group lessons..."
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
          />
        </div>
        <div className="fc-filter__selects group-lessons-filter__selects">
          <div className="fc-select">
            <select
              aria-label="Filter by coach"
              value={selectedCoach}
              onChange={(event) => onCoachChange(event.target.value)}
              className="fc-select__field"
            >
              {coachOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="fc-select__icon" aria-hidden="true" />
          </div>
          <div className="fc-select">
            <select
              aria-label="Filter by NTRP level"
              value={selectedLevel}
              onChange={(event) => onLevelChange(event.target.value)}
              className="fc-select__field"
            >
              {levelOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "All levels" ? option : `${option} NTRP`}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="fc-select__icon" aria-hidden="true" />
          </div>
        </div>
      </form>
    </div>
  );
};

export default GroupLessonsFilterBar;
