import "../coaches/coaches.css";
import "./players.css";

const PlayerCardSkeleton = () => {
  return (
    <div className="fp-card fp-card--skeleton" aria-hidden="true">
      <div className="fp-skeleton fp-skeleton--avatar" />
      <div className="fp-skeleton fp-skeleton--line fp-skeleton--line-lg" />
      <div className="fp-skeleton fp-skeleton--line" />
      <div className="fp-skeleton fp-skeleton--line" />
      <div className="fp-skeleton fp-skeleton--line" />
      <div className="fp-skeleton fp-skeleton--chip-row">
        <span className="fp-skeleton fp-skeleton--chip" />
        <span className="fp-skeleton fp-skeleton--chip" />
        <span className="fp-skeleton fp-skeleton--chip" />
      </div>
      <div className="fp-skeleton fp-skeleton--actions" />
    </div>
  );
};

export default PlayerCardSkeleton;
