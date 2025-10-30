import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PlayerHeader from "../components/PlayerHeader";
import ProfileManager from "../components/ProfileManager";
import { useAuth } from "../context/AuthContext";
import { getDisplayName } from "../utils/userDisplay";
import { getStoredAuthToken } from "../services/authToken";
import { fetchCoachDetailsById } from "../api/playerHome";
import {
  getCoachAvailability,
  getCoachAvatarColor,
  getCoachExperience,
  getCoachFocus,
  getCoachFullName,
  getCoachInitials,
  getCoachLessonTypes,
  getCoachLocations,
  getCoachRate,
  getCoachRating,
  getCoachReviewCount,
  getCoachSpecialties,
} from "../utils/coachFormatting";

const extractCoachPayload = (payload) => {
  if (!payload) return null;

  if (Array.isArray(payload)) {
    return payload[0] ?? null;
  }

  if (payload.data) {
    const nested = payload.data;
    if (Array.isArray(nested)) {
      return nested[0] ?? null;
    }
    if (nested && typeof nested === "object") {
      if (nested.data && typeof nested.data === "object" && !Array.isArray(nested.data)) {
        return nested.data;
      }
      if (nested.coach && typeof nested.coach === "object") {
        return nested.coach;
      }
      return nested;
    }
  }

  if (payload.coach && typeof payload.coach === "object" && !Array.isArray(payload.coach)) {
    return payload.coach;
  }

  if (typeof payload === "object" && !Array.isArray(payload)) {
    return payload;
  }

  return null;
};

const CoachDetailPage = () => {
  const { coachId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isProfileManagerOpen, setProfileManagerOpen] = useState(false);
  const [coach, setCoach] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const rawDisplayName = useMemo(() => getDisplayName(user), [user]);
  const headerDisplayName = rawDisplayName === "Player" ? "Paul" : rawDisplayName;

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadCoach = async () => {
      const token = getStoredAuthToken({ preferScheme: "token" });

      if (!token) {
        setError("Please sign in again to view coach details.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetchCoachDetailsById({
          token,
          coachId,
          signal: controller.signal,
        });

        if (!isMounted) return;

        const coachPayload = extractCoachPayload(response);
        setCoach(coachPayload);
      } catch (fetchError) {
        if (!isMounted) return;
        if (fetchError.name === "AbortError") return;
        const status = fetchError?.status;
        if (status === 404) {
          setError("We couldn't find this coach. They may no longer be available.");
        } else {
          setError(fetchError.message || "We couldn't load this coach right now.");
        }
        setCoach(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadCoach();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [coachId]);

  const handleBack = () => {
    navigate("/coaches");
  };

  const coachName = coach ? getCoachFullName(coach) : "";
  const coachFocus = coach ? getCoachFocus(coach) : "";
  const coachExperience = coach ? getCoachExperience(coach) : "";
  const coachSpecialties = coach ? getCoachSpecialties(coach) : [];
  const coachLocations = coach ? getCoachLocations(coach) : [];
  const coachLessonTypes = coach ? getCoachLessonTypes(coach) : [];
  const coachAvailability = coach ? getCoachAvailability(coach) : "";
  const coachRate = coach ? getCoachRate(coach) : null;
  const coachRating = coach ? getCoachRating(coach) : null;
  const coachReviewCount = coach ? getCoachReviewCount(coach) : null;

  const rateDisplay = coachRate ? `$${Math.round(coachRate)}/hr` : "Rate shared upon request";
  const ratingDisplay = coachRating ? coachRating.toFixed(1) : "New";
  const reviewDisplay =
    coachReviewCount && coachReviewCount > 0
      ? `${Math.round(coachReviewCount)} reviews`
      : "No reviews yet";

  return (
    <div className="coach-detail-page">
      <PlayerHeader
        onManageProfile={() => setProfileManagerOpen(true)}
        displayNameOverride={headerDisplayName}
      />
      <main className="coach-profile-content">
        <button type="button" className="back-to-list" onClick={handleBack}>
          ← Back to Find Coaches
        </button>
        {loading ? (
          <div className="coach-loading-state">Loading coach details…</div>
        ) : null}
        {!loading && error ? (
          <div className="coach-error-state" role="status">
            <h2>Unable to load this coach</h2>
            <p>{error}</p>
            <button type="button" className="cta-button" onClick={handleBack}>
              Browse coaches
            </button>
          </div>
        ) : null}
        {!loading && !error && coach ? (
          <article className="coach-detail-card">
            <div className="coach-detail-header">
              <div className="coach-avatar" style={{ backgroundColor: getCoachAvatarColor(coach) }}>
                {getCoachInitials(coach)}
              </div>
              <div className="coach-detail-info">
                <h2>{coachName}</h2>
                <div className="coach-detail-meta">
                  <span>⭐ {ratingDisplay}</span>
                  <span>{reviewDisplay}</span>
                  <span>{rateDisplay}</span>
                </div>
                <button type="button" className="cta-button">
                  Send Roster Request
                </button>
              </div>
            </div>
            <p className="coach-detail-summary">{coachExperience}</p>
            <p className="coach-detail-focus">{coachFocus}</p>
            <div className="coach-detail-section">
              <h3>Specialties</h3>
              <div className="detail-chip-grid">
                {coachSpecialties.length ? (
                  coachSpecialties.map((speciality) => (
                    <span key={speciality} className="detail-chip">
                      {speciality}
                    </span>
                  ))
                ) : (
                  <span className="detail-chip muted">More details coming soon</span>
                )}
              </div>
            </div>
            <div className="coach-detail-section">
              <h3>Coaching Locations</h3>
              <ul className="detail-list">
                {coachLocations.length ? (
                  coachLocations.map((location) => <li key={location}>{location}</li>)
                ) : (
                  <li>Locations shared after connecting.</li>
                )}
              </ul>
            </div>
            <div className="coach-detail-section">
              <h3>Available Lesson Types</h3>
              <div className="detail-chip-grid">
                {coachLessonTypes.length ? (
                  coachLessonTypes.map((lesson) => (
                    <span key={lesson} className="detail-chip">
                      {lesson}
                    </span>
                  ))
                ) : (
                  <span className="detail-chip muted">Lesson types coming soon</span>
                )}
              </div>
            </div>
            <div className="coach-detail-section availability">
              <h3>Typical availability</h3>
              <p>{coachAvailability}</p>
            </div>
          </article>
        ) : null}
      </main>
      <ProfileManager isOpen={isProfileManagerOpen} onClose={() => setProfileManagerOpen(false)} />
    </div>
  );
};

export default CoachDetailPage;
