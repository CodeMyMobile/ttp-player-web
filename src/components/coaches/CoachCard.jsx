import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Calendar, MapPin, User } from "lucide-react";
import {
  AVAILABILITY_PLACEHOLDER,
  RATE_PLACEHOLDER,
} from "../../utils/coachFormatting";
import "./CoachCard.css";

const CoachCard = ({ coach }) => {
  const navigate = useNavigate();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showAllLocations, setShowAllLocations] = useState(false);

  const profilePath = useMemo(
    () => `/coaches/${coach.slug ?? coach.id}`,
    [coach.id, coach.slug],
  );

  const locations = coach.locations ?? { visible: [], hiddenCount: 0, all: [] };
  const visibleLocations = showAllLocations ? locations.all : locations.visible;

  const handleNavigate = () => {
    navigate(profilePath);
  };

  const handleToggleLocations = (event) => {
    event.stopPropagation();
    setShowAllLocations((prev) => !prev);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleNavigate();
    }
  };

  const availabilityLabel = coach.availability || AVAILABILITY_PLACEHOLDER;
  const rateLabel = coach.rate?.display || RATE_PLACEHOLDER;
  const shouldShowSkeleton = Boolean(coach.avatarUrl) && !imageLoaded && !imageError;

  return (
    <article
      className="coach-card"
      tabIndex={0}
      role="button"
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
      aria-label={`View full profile for ${coach.name}`}
    >
      <div className="coach-card__media">
        {shouldShowSkeleton ? <div className="coach-card__avatar-skeleton" aria-hidden="true" /> : null}
        {coach.avatarUrl && !imageError ? (
          <img
            src={coach.avatarUrl}
            alt={`${coach.name}'s profile photo`}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="coach-card__initials" aria-hidden="true">
            <span>{coach.initials}</span>
          </div>
        )}
      </div>
      <div className="coach-card__content">
        <header className="coach-card__header">
          <div className="coach-card__title">
            <h3>{coach.name}</h3>
            {coach.headline ? (
              <p className="coach-card__headline" title={coach.headline}>
                {coach.headline}
              </p>
            ) : null}
          </div>
          <div className="coach-card__rate" aria-label="Hourly rate">
            {rateLabel}
          </div>
        </header>
        <div className="coach-card__availability" aria-label="Coach availability">
          <Calendar size={16} aria-hidden="true" />
          <span title={availabilityLabel}>{availabilityLabel}</span>
        </div>
        {visibleLocations.length ? (
          <div className="coach-card__locations" aria-label="Coach locations">
            <MapPin size={16} aria-hidden="true" />
            <div className="coach-card__locations-list">
              {visibleLocations.map((location) => (
                <span key={location} className="coach-card__location" title={location}>
                  {location}
                </span>
              ))}
              {locations.hiddenCount > 0 ? (
                <button
                  type="button"
                  className="coach-card__more-locations"
                  onClick={handleToggleLocations}
                  aria-expanded={showAllLocations}
                >
                  {showAllLocations ? "Show fewer" : `+${locations.hiddenCount} more`}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {coach.bio ? (
          <p className="coach-card__bio" title={coach.bio}>
            {coach.bio}
          </p>
        ) : null}
      </div>
      <footer className="coach-card__footer">
        <Link to={profilePath} className="coach-card__cta" onClick={(event) => event.stopPropagation()}>
          <User size={16} aria-hidden="true" />
          <span>View full profile</span>
        </Link>
      </footer>
    </article>
  );
};

export default CoachCard;
