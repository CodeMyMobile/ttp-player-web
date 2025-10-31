import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Star } from "lucide-react";
import type { Coach } from "../types";

interface CoachCardProps {
  coach: Coach;
}

const CoachCard = ({ coach }: CoachCardProps) => {
  const tagList = coach.specialties.slice(0, 3);
  const rateLabel = coach.hourlyRateDisplay ?? (coach.hourlyRate ? `$${Math.round(coach.hourlyRate)}/hr` : null);

  return (
    <article className="coach-card">
      <div className="coach-card__header">
        <div className="coach-card__avatar" aria-hidden>
          {coach.avatarUrl ? (
            <img src={coach.avatarUrl} alt="" loading="lazy" />
          ) : (
            <span>{coach.name.charAt(0)}</span>
          )}
        </div>
        <div className="coach-card__details">
          <h3>{coach.name}</h3>
          {coach.locationName || coach.distanceMiles ? (
            <p className="coach-card__meta">
              <MapPin aria-hidden size={14} />
              {coach.locationName ? (
                coach.locationName
              ) : (
                <span>
                  {/* TODO: replace with coach location once provided by the API */}
                  &mdash;
                </span>
              )}
              {coach.distanceMiles ? ` • ${coach.distanceMiles.toFixed(1)} mi` : ""}
            </p>
          ) : null}
        </div>
        {coach.rating ? (
          <div className="coach-card__rating" aria-label={`Rated ${coach.rating} out of 5`}>
            <Star aria-hidden size={14} />
            <span>
              {coach.rating.toFixed(1)}
              {coach.reviewsCount ? ` (${coach.reviewsCount})` : ""}
            </span>
          </div>
        ) : null}
      </div>
      {tagList.length ? (
        <ul className="coach-card__tags">
          {tagList.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      ) : (
        <p className="coach-card__placeholder">{/* TODO: replace with API specialties */}Specialties coming soon</p>
      )}
      <div className="coach-card__footer">
        {rateLabel ? <span className="coach-card__rate">{rateLabel}</span> : null}
        <Link className="coach-card__cta" to={`/coaches/${coach.slug}`}>
          View Profile
          <ArrowRight aria-hidden size={14} />
        </Link>
      </div>
    </article>
  );
};

export default CoachCard;
