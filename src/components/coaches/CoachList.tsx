import { useMemo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { usePlayerCoaches } from '../../hooks/playerHome';
import CoachCard from './CoachCard';
import CoachCardSkeleton from './CoachCardSkeleton';
import { extractCoaches, normalizeCoach } from '../../utils/coachFormatters';
import './CoachList.css';

const SKELETON_COUNT = 6;

const CoachList = () => {
  const { data, error, loading, refetch } = usePlayerCoaches({ perPage: 12 });

  const coaches = useMemo(() => {
    const rawCoaches = extractCoaches(data);
    return rawCoaches
      .map((coach) => normalizeCoach(coach))
      .filter((coach): coach is NonNullable<typeof coach> => Boolean(coach));
  }, [data]);

  if (loading && !data) {
    return (
      <div className="coach-list" aria-label="Loading coach cards">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <CoachCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="coach-list__error" role="alert">
        <AlertTriangle aria-hidden="true" />
        <div>
          <p>We couldn&apos;t load coaches right now.</p>
          <button type="button" onClick={() => void refetch()}>
            <RefreshCw size={16} aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!coaches.length) {
    return (
      <div className="coach-list__empty">
        <p>No coaches available right now. Check back later!</p>
      </div>
    );
  }

  return (
    <div className="coach-list" role="list">
      {coaches.map((coach) => (
        <CoachCard key={coach.id} coach={coach} />
      ))}
    </div>
  );
};

export default CoachList;
