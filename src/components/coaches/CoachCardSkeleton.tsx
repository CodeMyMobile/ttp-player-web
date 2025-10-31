import "./coaches.css";

const CoachCardSkeleton = () => {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card__image" />
      <div className="skeleton-card__body">
        <div className="skeleton-card__pill" />
        <div className="skeleton-card__line skeleton-card__line--wide" />
        <div className="skeleton-card__line skeleton-card__line--medium" />
        <div className="skeleton-card__line skeleton-card__line--narrow" />
        <div className="skeleton-card__pill skeleton-card__pill--small" />
        <div className="skeleton-card__line skeleton-card__line--wide" />
        <div className="skeleton-card__line skeleton-card__line--medium" />
        <div className="skeleton-card__button" />
      </div>
    </div>
  );
};

export default CoachCardSkeleton;
