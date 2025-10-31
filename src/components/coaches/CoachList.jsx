import { useMemo } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { usePlayerCoaches } from "../../hooks/playerHome";
import { normalizeCoaches } from "../../utils/coachFormatting";
import CoachCard from "./CoachCard";
import CoachCardSkeleton from "./CoachCardSkeleton";
import "./CoachList.css";

const CoachList = () => {
  const { data, loading, error, refetch } = usePlayerCoaches({ perPage: 12 });

  const coaches = useMemo(() => normalizeCoaches(data), [data]);

  if (error) {
    return (
      <div className="coach-list__state coach-list__state--error" role="alert">
        <AlertTriangle aria-hidden="true" size={20} />
        <div>
          <p>We couldn&apos;t load coaches right now.</p>
          <button type="button" onClick={() => refetch?.()}>
            <RefreshCcw size={16} aria-hidden="true" />
            <span>Try again</span>
          </button>
        </div>
      </div>
    );
  }

  if (loading && (!coaches || coaches.length === 0)) {
    return (
      <div className="coach-list__grid" aria-label="Loading coach cards">
        {Array.from({ length: 6 }).map((_, index) => (
          <CoachCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (!coaches.length) {
    return (
      <div className="coach-list__state coach-list__state--empty">
        <p>No coaches were found. Adjust your filters or try again later.</p>
      </div>
    );
  }

  return (
    <div className="coach-list__grid">
      {coaches.map((coach) => (
        <CoachCard key={coach.id} coach={coach} />
      ))}
    </div>
  );
};

export default CoachList;
