import { useMemo, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, User } from 'lucide-react';
import type { NormalizedCoach } from '../../utils/coachFormatters';
import { AVAILABILITY_FALLBACK, RATE_FALLBACK } from '../../utils/coachFormatters';
import './CoachCard.css';

export interface CoachCardProps {
  coach: NormalizedCoach;
}

const CoachCard = ({ coach }: CoachCardProps) => {
  const navigate = useNavigate();
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const profilePath = useMemo(() => `/coaches/${coach.slug ?? coach.id}`, [coach.id, coach.slug]);

  const locations = useMemo(() => {
    if (!coach.locations) {
      return {
        visible: [],
        hiddenCount: 0,
        all: [],
      };
    }
    const { visible, hiddenCount, all } = coach.locations;
    if (showAllLocations) {
      return {
        visible: all,
        hiddenCount: 0,
        all,
      };
    }
    return { visible, hiddenCount, all };
  }, [coach.locations, showAllLocations]);

  const handleCardClick = () => {
    navigate(profilePath);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigate(profilePath);
    }
  };

  const rateLabel = coach.rate.display || RATE_FALLBACK;
  const availabilityLabel = coach.availability || AVAILABILITY_FALLBACK;

  const showSkeleton = Boolean(coach.avatarUrl) && !imageLoaded && !imageError;

  return (
    <article
      className="coach-card"
      role="button"
      tabIndex={0}
      aria-label={`View full profile for ${coach.name}`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
    >
      <div className="coach-card__media">
        {showSkeleton ? <div className="coach-card__avatar-skeleton" aria-hidden="true" /> : null}
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
      <div className="coach-card__body">
        <header className="coach-card__header">
          <div className="coach-card__title">
            <h3>{coach.name}</h3>
            <p className="coach-card__headline" title={coach.headline}>
              {coach.headline}
            </p>
          </div>
          <div className="coach-card__rate" aria-label="Hourly rate">
            {rateLabel}
          </div>
        </header>
        <div className="coach-card__meta" aria-label="Coach availability">
          <Calendar size={16} aria-hidden="true" />
          <span title={availabilityLabel}>{availabilityLabel}</span>
        </div>
        {locations.visible.length ? (
          <div className="coach-card__locations" aria-label="Coach locations">
            <MapPin size={16} aria-hidden="true" />
            <div className="coach-card__locations-list">
              {locations.visible.map((location) => (
                <span key={location} title={location} className="coach-card__location-item">
                  {location}
                </span>
              ))}
              {locations.hiddenCount > 0 ? (
                <button
                  type="button"
                  className="coach-card__more-locations"
                  onClick={() => setShowAllLocations((value) => !value)}
                  aria-expanded={showAllLocations}
                >
                  {showAllLocations ? 'Show less' : `+${locations.hiddenCount} more`}
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
      <div className="coach-card__footer">
        <Link to={profilePath} className="coach-card__cta" aria-label={`View full profile for ${coach.name}`}>
          <User size={16} aria-hidden="true" />
          <span>View full profile</span>
        </Link>
      </div>
    </article>
  );
};

export default CoachCard;
