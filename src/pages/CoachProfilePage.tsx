import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Calendar, MapPin } from 'lucide-react';
import CoachCard from '../components/coaches/CoachCard';
import CoachCardSkeleton from '../components/coaches/CoachCardSkeleton';
import { getStoredAuthToken } from '../services/authToken';
import { useFetchCoachDetailsById } from '../hooks/playerHome';
import { normalizeCoach, type NormalizedCoach, type RawCoach } from '../utils/coachFormatters';
import './CoachProfilePage.css';

const CoachProfilePage = () => {
  const { coachId } = useParams();
  const token = getStoredAuthToken({ preferScheme: 'Bearer' }) ?? '';
  const skip = !coachId || !token;
  const { data, error, loading, refetch } = useFetchCoachDetailsById(
    { coachId: coachId ?? '', token },
    { skip, immediate: !skip },
  );

  let normalized: NormalizedCoach | null = null;
  if (data) {
    normalized = normalizeCoach(data as RawCoach) ?? null;
  }

  return (
    <main className="coach-profile" aria-live="polite">
      <header className="coach-profile__header">
        <Link to="/coaches" className="coach-profile__back">
          <ArrowLeft size={18} aria-hidden="true" />
          Back to all coaches
        </Link>
        <h1>Coach profile</h1>
      </header>
      {skip ? (
        <div className="coach-profile__message">
          <AlertTriangle aria-hidden="true" />
          <p>We need an active session to load this coach. Please sign in again.</p>
        </div>
      ) : null}
      {loading && !normalized ? (
        <CoachCardSkeleton />
      ) : null}
      {error ? (
        <div className="coach-profile__error" role="alert">
          <AlertTriangle aria-hidden="true" />
          <p>We couldn&apos;t load this coach. Please try again.</p>
          <button type="button" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      ) : null}
      {normalized ? (
        <section className="coach-profile__content">
          <CoachCard coach={normalized} />
          <div className="coach-profile__details">
            <h2>Availability</h2>
            <p>
              <Calendar size={18} aria-hidden="true" />
              <span>{normalized.availability}</span>
            </p>
            {normalized.locations.all.length ? (
              <div>
                <h2>Locations</h2>
                <ul>
                  {normalized.locations.all.map((location) => (
                    <li key={location}>
                      <MapPin size={16} aria-hidden="true" />
                      <span>{location}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
};

export default CoachProfilePage;
