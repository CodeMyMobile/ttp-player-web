import { ChevronDown, MapPin, Search } from "lucide-react";
import type { FormEvent } from "react";

import "../coaches/coaches.css";
import "./players.css";

type PlayersFilterBarProps = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSearch: () => void;
  radiusOptions: string[];
  selectedRadius: string;
  onRadiusChange: (value: string) => void;
  levelOptions: string[];
  selectedLevel: string;
  onLevelChange: (value: string) => void;
  availabilityOptions: string[];
  selectedAvailability: string;
  onAvailabilityChange: (value: string) => void;
  verifiedOnly: boolean;
  onVerifiedOnlyChange: (value: boolean) => void;
};

const PlayersFilterBar = ({
  searchTerm,
  onSearchTermChange,
  onSearch,
  radiusOptions,
  selectedRadius,
  onRadiusChange,
  levelOptions,
  selectedLevel,
  onLevelChange,
  availabilityOptions,
  selectedAvailability,
  onAvailabilityChange,
  verifiedOnly,
  onVerifiedOnlyChange,
}: PlayersFilterBarProps) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch();
  };

  return (
    <div className="fc-filter">
      <div className="fc-filter__distance-row">
        <div className="fc-filter__distance-group">
          <button type="button" className="fc-distance-chip fc-distance-chip--location" aria-label="Selected location">
            <MapPin size={18} />
            New York City, NY
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
            aria-label="Search players"
            placeholder="Search by name, style, or neighborhood"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
          />
        </div>
        <div className="fc-filter__selects">
          <div className="fc-select">
            <select
              aria-label="Filter by level"
              value={selectedLevel}
              className="fc-select__field"
              onChange={(event) => onLevelChange(event.target.value)}
            >
              {levelOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="fc-select__icon" aria-hidden="true" />
          </div>

          <div className="fc-select">
            <select
              aria-label="Filter by availability"
              value={selectedAvailability}
              className="fc-select__field"
              onChange={(event) => onAvailabilityChange(event.target.value)}
            >
              {availabilityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="fc-select__icon" aria-hidden="true" />
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
            Verified players
          </label>
        </div>
      </form>
    </div>
  );
};

export default PlayersFilterBar;
