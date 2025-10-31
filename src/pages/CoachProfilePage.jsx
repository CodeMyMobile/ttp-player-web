import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import CoachCard from "../components/coaches/CoachCard";
import CoachCardSkeleton from "../components/coaches/CoachCardSkeleton";
import { useFetchCoachDetailsById } from "../hooks/playerHome";
import { normalizeCoach } from "../utils/coachFormatting";
import { getStoredAuthToken } from "../services/authToken";
import "./CoachProfilePage.css";

const CoachProfilePage = () => {
  const { coachId } = useParams();
  const token = getStoredAuthToken({ preferScheme: "Bearer" });

  const { data, loading, error, refetch } = useFetchCoachDetailsById(
    { coachId, token },
    { skip: !coachId || !token },
  );

  const coach = useMemo(() => normalizeCoach(data), [data]);

  return (
    <div className="coach-profile" aria-live="polite">
      <header className="coach-profile__hero">
        <h1>Coach profile</h1>
        <p>Review availability, rates, and venues before booking a private session.</p>
      </header>
      <main className="coach-profile__content">
        {loading ? (
          <CoachCardSkeleton />
        ) : error ? (
          <div className="coach-profile__error" role="alert">
            <AlertTriangle aria-hidden="true" size={20} />
            <div>
              <p>We couldn&apos;t load this coach right now.</p>
              <button type="button" onClick={() => refetch?.()}>
                <RefreshCcw size={16} aria-hidden="true" />
                <span>Try again</span>
              </button>
            </div>
          </div>
        ) : coach ? (
          <CoachCard coach={coach} />
        ) : (
          <p className="coach-profile__empty">Coach details are unavailable.</p>
        )}
      </main>
    </div>
  );
};

export default CoachProfilePage;
