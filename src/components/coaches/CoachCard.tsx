import type { KeyboardEventHandler } from "react";
import { Calendar, MapPin, MessageCircle, Sparkles, Star, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

import type { Coach, CoachHighlight } from "../../data/mockCoaches";
import TagPill from "./TagPill";

import "./coaches.css";

const highlightIconMap: Record<CoachHighlight["icon"], JSX.Element> = {
  calendar: <Calendar size={18} strokeWidth={2} />,
  map: <MapPin size={18} strokeWidth={2} />,
  message: <MessageCircle size={18} strokeWidth={2} />,
  users: <Users size={18} strokeWidth={2} />,
  spark: <Sparkles size={18} strokeWidth={2} />,
};

type CoachCardProps = {
  coach: Coach;
};

const CoachCard = ({ coach }: CoachCardProps) => {
  const navigate = useNavigate();

  const goToProfile = () => {
    navigate(`/coaches/${coach.id}`);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLElement> = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      goToProfile();
    }
  };

  return (
    <article
      className="fc-card fc-card--interactive"
      role="link"
      tabIndex={0}
      aria-label={`View profile for ${coach.name}`}
      onClick={goToProfile}
      onKeyDown={handleKeyDown}
    >
      <div className="fc-card__top">
        <div className="fc-card__labels">
          <TagPill tone="available">{coach.availabilityTag}</TagPill>
          {coach.featured && <TagPill tone="featured">Featured</TagPill>}
        </div>
        <div className="fc-card__price">
          <span className="fc-card__price-value">{coach.pricePerHour}</span>
          <span className="fc-card__price-caption">per hour</span>
        </div>
      </div>

      <div className="fc-card__profile">
        <img className="fc-card__avatar" src={coach.imageUrl} alt={`Portrait of ${coach.name}`} />
        <div className="fc-card__identity">
          <h3 className="fc-card__name">{coach.name}</h3>
          <span className="fc-card__title">{coach.title}</span>
          <div className="fc-card__rating">
            <span className="fc-card__rating-badge">
              <Star size={16} fill="#FDB022" stroke="none" />
              {coach.rating.toFixed(1)}
            </span>
            <span>• {coach.reviewCount} reviews</span>
          </div>
        </div>
      </div>

      <p className="fc-card__summary">{coach.summary}</p>

      <ul className="fc-card__highlights">
        {coach.highlights.map((highlight) => (
          <li key={highlight.label} className="fc-card__highlight">
            {highlightIconMap[highlight.icon]}
            <span>{highlight.label}</span>
          </li>
        ))}
      </ul>

      <div className="fc-card__tags">
        {coach.tags.map((tag) => (
          <TagPill key={tag}>{tag}</TagPill>
        ))}
      </div>

      <div className="fc-card__actions">
        <button
          type="button"
          className="fc-button fc-button--secondary"
          onClick={(event) => {
            event.stopPropagation();
            goToProfile();
          }}
        >
          View profile
        </button>
        <button
          type="button"
          className="fc-button fc-button--primary"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          Book lesson
        </button>
      </div>
    </article>
  );
};

export default CoachCard;
