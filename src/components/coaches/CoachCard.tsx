import type { KeyboardEventHandler } from "react";
import { Award, Calendar, Sparkles, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

import type { Coach } from "../../data/mockCoaches";
import TagPill from "./TagPill";

import "./coaches.css";

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

  const availabilityHighlight = coach.highlights.find((highlight) => highlight.icon === "calendar");
  const callouts = [
    {
      key: "group-lessons",
      icon: <Users size={18} strokeWidth={2} />,
      text: `Group lessons available · ${coach.lessonRates.group}`,
    },
    {
      key: "package-discounts",
      icon: <Sparkles size={18} strokeWidth={2} />,
      text: "Package discounts offered",
    },
  ];

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

      <div className="fc-card__quick-stats">
        <div className="fc-card__quick-stat">
          <span className="fc-card__quick-stat-label">Experience</span>
          <span className="fc-card__quick-stat-value">{coach.yearsExperience}+ yrs coaching</span>
        </div>
        <div className="fc-card__quick-stat">
          <span className="fc-card__quick-stat-label">Focus levels</span>
          <span className="fc-card__quick-stat-value">{summarizeList(coach.levels, 2)}</span>
        </div>
        <div className="fc-card__quick-stat">
          <span className="fc-card__quick-stat-label">Languages</span>
          <span className="fc-card__quick-stat-value">{summarizeList(coach.languages, 3)}</span>
        </div>
        <div className="fc-card__quick-stat">
          <span className="fc-card__quick-stat-label">Availability</span>
          <span className="fc-card__quick-stat-value">
            {availabilityHighlight?.label ?? coach.availability}
          </span>
        </div>
      </div>

      <div className="fc-card__lesson">
        <div className="fc-card__lesson-icon">
          <Calendar size={18} strokeWidth={2} />
        </div>
        <div className="fc-card__lesson-copy">
          <span className="fc-card__lesson-label">Next lesson</span>
          <span className="fc-card__lesson-time">
            {coach.nextAvailableLesson.day} · {coach.nextAvailableLesson.time}
          </span>
          <span className="fc-card__lesson-court">{coach.nextAvailableLesson.court}</span>
        </div>
      </div>

      <ul className="fc-card__callouts">
        {callouts.map((callout) => (
          <li key={callout.key} className="fc-card__callout">
            <span className="fc-card__callout-icon">{callout.icon}</span>
            <span className="fc-card__callout-text">{callout.text}</span>
          </li>
        ))}
      </ul>

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
