import type { KeyboardEventHandler } from "react";
import { Award, Calendar, MapPin, MessageCircle, Sparkles, Users } from "lucide-react";
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

const summarizeList = (items: string[], maxVisible = 2) => {
  if (items.length === 0) {
    return "";
  }

  if (items.length <= maxVisible) {
    return items.join(", ");
  }

  const visible = items.slice(0, maxVisible).join(", ");
  const remaining = items.length - maxVisible;

  return `${visible} +${remaining} more`;
};

type CoachCardProps = {
  coach: Coach;
  onBook?: (coach: Coach) => void;
};

const CoachCard = ({ coach, onBook }: CoachCardProps) => {
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
          {coach.featured && <TagPill tone="featured">Featured</TagPill>}
          {coach.certifications.length > 0 && (
            <TagPill tone="accent" icon={<Award size={14} strokeWidth={2} />}>
              Certified
            </TagPill>
          )}
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
          {coach.certifications.length > 0 && (
            <div className="fc-card__credentials">
              <div className="fc-card__certifications">
                {coach.certifications.slice(0, 2).map((certification) => (
                  <span key={certification} className="fc-card__certification">
                    <Award size={14} strokeWidth={2} />
                    <span>{certification}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="fc-card__summary">{coach.summary}</p>

      <div className="fc-card__meta">
        <div className="fc-card__meta-item">
          <span className="fc-card__meta-label">Experience</span>
          <span className="fc-card__meta-value">{coach.yearsExperience}+ yrs coaching</span>
        </div>
        <div className="fc-card__meta-item">
          <span className="fc-card__meta-label">Focus levels</span>
          <span className="fc-card__meta-value">{summarizeList(coach.levels)}</span>
        </div>
        <div className="fc-card__meta-item">
          <span className="fc-card__meta-label">Languages</span>
          <span className="fc-card__meta-value">{summarizeList(coach.languages)}</span>
        </div>
      </div>

      <div className="fc-card__next-availability">
        <div className="fc-card__next-availability-icon">
          <Calendar size={18} strokeWidth={2} />
        </div>
        <div className="fc-card__next-availability-copy">
          <span className="fc-card__next-availability-label">Next lesson</span>
          <span className="fc-card__next-availability-time">
            {coach.nextAvailableLesson.day} · {coach.nextAvailableLesson.time}
          </span>
          <span className="fc-card__next-availability-court">{coach.nextAvailableLesson.court}</span>
        </div>
      </div>

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
            onBook?.(coach);
          }}
        >
          Book now
        </button>
      </div>
    </article>
  );
};

export default CoachCard;
