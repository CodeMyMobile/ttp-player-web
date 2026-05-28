import { Filter, MapPin, Search } from "lucide-react";
import { useState, type FormEvent } from "react";

import "../coaches/coaches.css";
import "./players.css";

type PlayersFilterBarProps = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSearch: () => void;
  locationLabel: string;
  onLocationClick: () => void;
  isLocationPickerOpen: boolean;
  radiusOptions: string[];
  selectedRadius: string;
  onRadiusChange: (value: string) => void;
  levelOptions: string[];
  selectedLevel: string;
  onLevelChange: (value: string) => void;
  genderOptions: string[];
  selectedGender: string;
  onGenderChange: (value: string) => void;
  playTypeOptions?: string[];
  selectedPlayType?: string;
  onPlayTypeChange?: (value: string) => void;
  availabilityOptions?: string[];
  selectedAvailability?: string;
  onAvailabilityChange?: (value: string) => void;
  verifiedOnly: boolean;
  onVerifiedOnlyChange: (value: boolean) => void;
};

const PlayersFilterBar = ({
  searchTerm,
  onSearchTermChange,
  onSearch,
  locationLabel,
  onLocationClick,
  isLocationPickerOpen,
  radiusOptions,
  selectedRadius,
  onRadiusChange,
  levelOptions,
  selectedLevel,
  onLevelChange,
  genderOptions,
  selectedGender,
  onGenderChange,
  playTypeOptions = ["All play types"],
  selectedPlayType = "All play types",
  onPlayTypeChange = () => undefined,
  availabilityOptions = ["All availability"],
  selectedAvailability = "All availability",
  onAvailabilityChange = () => undefined,
  verifiedOnly,
  onVerifiedOnlyChange,
}: PlayersFilterBarProps) => {
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch();
  };

  return (
    <div className="fc-filter">
      <form className="fc-filter__search-form" onSubmit={handleSubmit}>
        <div className="fc-filter__search">
          <Search className="fc-filter__search-icon" size={18} strokeWidth={2} />
          <input
            aria-label="Search players"
            placeholder="Search by name, style or neighbourhood..."
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
          />
        </div>
      </form>

      <div className="fc-filter__row">
        <span className="fc-filter__label">Within</span>
        <div className="fc-filter__chips">
          <button
            type="button"
            className={`fc-distance-chip fc-distance-chip--location${
              isLocationPickerOpen ? " fc-distance-chip--active" : ""
            }`}
            aria-label={locationLabel ? `Selected location: ${locationLabel}` : "Select location"}
            aria-expanded={isLocationPickerOpen}
            aria-controls="player-location-picker"
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

      <div className="fc-filter__row">
        <span className="fc-filter__label">Level</span>
        <div className="fc-filter__chips">
          {levelOptions.map((level) => (
            <button
              key={level}
              type="button"
              className={`fc-distance-chip${selectedLevel === level ? " fc-distance-chip--active" : ""}`}
              onClick={() => onLevelChange(level)}
            >
              {level === "All levels" ? "Any" : level}
            </button>
          ))}
        </div>
      </div>

      <div className={`fc-filter__row fc-filter__row--secondary${showMoreFilters ? " fc-filter__row--mobile-open" : ""}`}>
        <span className="fc-filter__label">Gender</span>
        <div className="fc-filter__chips">
          {genderOptions.map((gender) => (
            <button
              key={gender}
              type="button"
              className={`fc-distance-chip${selectedGender === gender ? " fc-distance-chip--active" : ""}`}
              onClick={() => onGenderChange(gender)}
            >
              {gender === "All genders" ? "Any" : gender}
            </button>
          ))}
        </div>
      </div>

      <div className={`fc-filter__row fc-filter__row--secondary${showMoreFilters ? " fc-filter__row--mobile-open" : ""}`}>
        <span className="fc-filter__label">Style</span>
        <div className="fc-filter__chips">
          {playTypeOptions.map((playType) => (
            <button
              key={playType}
              type="button"
              className={`fc-distance-chip${selectedPlayType === playType ? " fc-distance-chip--active" : ""}`}
              onClick={() => onPlayTypeChange(playType)}
            >
              {playType === "All play types" ? "Any" : playType}
            </button>
          ))}
        </div>
      </div>

      <div className={`fc-filter__row fc-filter__row--secondary${showMoreFilters ? " fc-filter__row--mobile-open" : ""}`}>
        <span className="fc-filter__label">When</span>
        <div className="fc-filter__chips">
          {availabilityOptions.map((availability) => (
            <button
              key={availability}
              type="button"
              className={`fc-distance-chip${selectedAvailability === availability ? " fc-distance-chip--active" : ""}`}
              onClick={() => onAvailabilityChange(availability)}
            >
              {availability === "All availability" ? "Any" : availability}
            </button>
          ))}
        </div>
        <label
          className={`fp-verified-toggle${verifiedOnly ? " fp-verified-toggle--active" : ""}`}
          htmlFor="verified-toggle"
        >
          <input
            id="verified-toggle"
            type="checkbox"
            checked={verifiedOnly}
            onChange={(event) => onVerifiedOnlyChange(event.target.checked)}
          />
          <span className="fp-verified-toggle__pill">
            <span className="fp-verified-toggle__thumb" />
          </span>
          Verified only
        </label>
      </div>

      <button
        type="button"
        className="fc-filter__more"
        aria-expanded={showMoreFilters}
        onClick={() => setShowMoreFilters((current) => !current)}
      >
        <Filter size={14} strokeWidth={2} aria-hidden="true" />
        More filters
      </button>
    </div>
  );
};

export default PlayersFilterBar;
