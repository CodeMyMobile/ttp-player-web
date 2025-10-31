import { ArrowUpRight, MapPin, MessageCircle, Star } from "lucide-react";
import type { Coach } from "../../data/mockCoaches";
import TagPill from "./TagPill";

import "./coaches.css";

type CoachCardProps = {
  coach: Coach;
};

const CoachCard = ({ coach }: CoachCardProps) => {
  return (
    <article className="coach-card">
      <div className="coach-card__image-wrapper">
        <img className="coach-card__image" src={coach.imageUrl} alt={`Portrait of ${coach.name}`} />
        <div className="coach-card__tag-stack">
          {coach.featured && <TagPill tone="accent">Featured coach</TagPill>}
          {coach.availability && (
            <TagPill tone="available">
              <span className="status-dot" />
              {coach.availability}
            </TagPill>
          )}
        </div>
      </div>
      <div className="coach-card__body">
        <header className="coach-card__header">
          <div className="coach-card__title-group">
            <div className="coach-card__name-row">
              <h3 className="coach-card__name">{coach.name}</h3>
              <span className="coach-card__rating">
                <Star size={16} fill="currentColor" strokeWidth={0} />
                {coach.rating.toFixed(1)}
              </span>
            </div>
            <div className="coach-card__meta">
              <MapPin size={16} />
              <span>{coach.location}</span>
              {coach.sessions && <span>• {coach.sessions}</span>}
            </div>
            {coach.status && (
              <div className="coach-card__status">
                <span className="status-dot" />
                {coach.status}
              </div>
            )}
          </div>
          <div className="coach-card__price">
            <span className="coach-card__price-value">{coach.pricePerHour}</span>
            <span className="coach-card__price-caption">Private lesson</span>
          </div>
        </header>
        {coach.summary && <p className="coach-card__summary">{coach.summary}</p>}
        <div className="coach-card__tags">
          {coach.tags.map((tag) => (
            <TagPill key={tag}>{tag}</TagPill>
          ))}
        </div>
        <footer className="coach-card__footer">
          <button type="button" className="coach-card__secondary">
            <MessageCircle size={18} /> Message
          </button>
          <button type="button" className="coach-card__primary">
            Book lesson <ArrowUpRight size={18} />
          </button>
        </footer>
      </div>
    </article>
  );
};

export default CoachCard;
