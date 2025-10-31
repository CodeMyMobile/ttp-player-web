import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Star } from "lucide-react";
import type { Coach } from "../types";

interface FeaturedCoachCardProps {
  coach: Coach;
}

const FeaturedCoachCard = ({ coach }: FeaturedCoachCardProps) => {
  const tagList = coach.specialties.slice(0, 4);

  return (
    <article className="featured-coach-card">
      <div className="featured-coach-card__header">
        <div className="featured-coach-card__avatar" aria-hidden>
          {coach.avatarUrl ? (
            <img src={coach.avatarUrl} alt="" loading="lazy" />
          ) : (
            <span>{coach.name.charAt(0)}</span>
          )}
        </div>
        <div>
          <h3>{coach.name}</h3>
          {coach.locationName ? (
            <p className="featured-coach-card__location">
              <MapPin aria-hidden size={16} />
              {coach.locationName}
            </p>
          ) : null}
        </div>
        {coach.rating ? (
          <div className="featured-coach-card__rating" aria-label={`Rated ${coach.rating} out of 5`}>
            <Star aria-hidden size={16} />
            <span>
              {coach.rating.toFixed(1)}
              {coach.reviewsCount ? ` (${coach.reviewsCount})` : ""}
            </span>
          </div>
        ) : null}
      </div>
      {coach.bio ? <p className="featured-coach-card__bio">{coach.bio}</p> : null}
      {tagList.length ? (
        <ul className="featured-coach-card__tags">
          {tagList.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      ) : null}
      <div className="featured-coach-card__footer">
        {coach.hourlyRateDisplay ? <span className="featured-coach-card__rate">{coach.hourlyRateDisplay}</span> : null}
        {coach.availability ? (
          <span className="featured-coach-card__availability">{coach.availability}</span>
        ) : (
          <span className="featured-coach-card__availability">
            {/* TODO: replace with API-provided availability */}
            Availability updated daily
          </span>
        )}
        <Link className="featured-coach-card__cta" to={`/coaches/${coach.slug}`}>
          View Profile
          <ArrowRight aria-hidden size={16} />
        </Link>
      </div>
    </article>
  );
};

export default FeaturedCoachCard;
