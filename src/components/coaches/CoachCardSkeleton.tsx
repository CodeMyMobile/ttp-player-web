import './CoachCardSkeleton.css';

const CoachCardSkeleton = () => (
  <div className="coach-card-skeleton" aria-hidden="true">
    <div className="coach-card-skeleton__media" />
    <div className="coach-card-skeleton__content">
      <div className="coach-card-skeleton__line coach-card-skeleton__line--title" />
      <div className="coach-card-skeleton__line coach-card-skeleton__line--subtitle" />
      <div className="coach-card-skeleton__line" />
      <div className="coach-card-skeleton__line coach-card-skeleton__line--short" />
      <div className="coach-card-skeleton__cta" />
    </div>
  </div>
);

export default CoachCardSkeleton;
