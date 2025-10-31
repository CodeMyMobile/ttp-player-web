import "./coaches.css";

const CoachCardSkeleton = () => {
  return (
    <div className="skeleton-card" aria-hidden>
      <div className="skeleton-row">
        <div className="skeleton-badge" />
        <div className="skeleton-badge" />
      </div>
      <div className="skeleton-row">
        <div className="skeleton-avatar" />
        <div className="skeleton-stack">
          <div className="skeleton-line skeleton-line--wide" />
          <div className="skeleton-line skeleton-line--medium" />
          <div className="skeleton-line skeleton-line--narrow" />
        </div>
      </div>
      <div className="skeleton-line skeleton-line--wide" />
      <div className="skeleton-row">
        <div className="skeleton-line skeleton-line--medium" />
        <div className="skeleton-line skeleton-line--medium" />
        <div className="skeleton-line skeleton-line--medium" />
      </div>
      <div className="skeleton-row">
        <div className="skeleton-badge" />
        <div className="skeleton-badge" />
        <div className="skeleton-badge" />
      </div>
    </div>
  );
};

export default CoachCardSkeleton;
