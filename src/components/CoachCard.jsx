import {
  CalendarCheck,
  MapPin,
  MessageCircle,
  Star,
  Users2,
} from "lucide-react";

const badgeVariantClass = {
  available: "available",
  featured: "featured",
  default: "default",
};

const CoachCard = ({ coach }) => {
  return (
    <article className="coach-card" aria-label={`${coach.name} coach card`}>
      <header className="coach-card__header">
        <div className="coach-card__info">
          <div className="badge-row" aria-hidden="true">
            {coach.badges.map((badge) => (
              <span
                key={badge.id}
                className={`status-badge ${badgeVariantClass[badge.variant] || badgeVariantClass.default}`}
              >
                {badge.label}
              </span>
            ))}
          </div>
          <div className="name-row">
            <h2>{coach.name}</h2>
            <div className="rating" aria-label={`${coach.rating} out of 5 stars`}>
              <Star size={16} strokeWidth={2} aria-hidden="true" />
              <span>{coach.rating.toFixed(1)}</span>
              <span className="rating-muted">({coach.reviews} reviews)</span>
            </div>
          </div>
          <p className="club-line">
            {coach.club}
            {coach.experienceLabel ? ` • ${coach.experienceLabel}` : ""}
          </p>
        </div>
        <div className="price-stack" aria-label={`$${coach.price} per hour`}>
          <span className="price">${coach.price}</span>
          <span className="price-caption">per hour</span>
        </div>
      </header>

      <div className="coach-card__body">
        <ul className="coach-meta">
          <li>
            <MapPin size={16} strokeWidth={2} aria-hidden="true" />
            <span>{coach.distance}</span>
          </li>
          <li>
            <Users2 size={16} strokeWidth={2} aria-hidden="true" />
            <span>{coach.program}</span>
          </li>
          <li>
            <MessageCircle size={16} strokeWidth={2} aria-hidden="true" />
            <span>{coach.responseTime}</span>
          </li>
        </ul>
        <div className="coach-highlights">
          <span className="highlight-pill">
            <CalendarCheck size={14} strokeWidth={2} aria-hidden="true" />
            {coach.schedule}
          </span>
          {coach.specialties.map((item) => (
            <span key={item} className="highlight-pill subtle">
              {item}
            </span>
          ))}
        </div>
      </div>

      <footer className="coach-card__footer">
        <button type="button" className="ghost-button">
          View profile
        </button>
        <button type="button" className="primary-button">
          Book lesson
        </button>
      </footer>
    </article>
  );
};

export default CoachCard;
