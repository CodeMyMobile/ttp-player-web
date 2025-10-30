import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PlayerHeader from "../components/PlayerHeader";
import ProfileManager from "../components/ProfileManager";
import { useAuth } from "../context/AuthContext";
import { getDisplayName } from "../utils/userDisplay";
import { getCoachById } from "../data/coachData";

const CoachDetailPage = () => {
  const { coachId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isProfileManagerOpen, setProfileManagerOpen] = useState(false);

  const rawDisplayName = useMemo(() => getDisplayName(user), [user]);
  const headerDisplayName = rawDisplayName === "Player" ? "Paul" : rawDisplayName;

  const coach = useMemo(() => getCoachById(coachId), [coachId]);

  const handleBack = () => {
    navigate("/coaches");
  };

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
        {coach ? (
          <article className="coach-detail-card">
            <div className="coach-detail-header">
              <div className="coach-avatar" style={{ backgroundColor: coach.avatarColor }}>
                {coach.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </div>
              <div className="coach-detail-info">
                <h2>{coach.name}</h2>
                <div className="coach-detail-meta">
                  <span>⭐ {coach.rating}</span>
                  <span>{coach.reviewCount} reviews</span>
                  <span>${coach.rate} per hour</span>
                </div>
                <button type="button" className="cta-button">
                  Send Roster Request
                </button>
              </div>
            </div>
            <p className="coach-detail-summary">{coach.experience}</p>
            <p className="coach-detail-focus">{coach.focus}</p>
            <div className="coach-detail-section">
              <h3>Specialties</h3>
              <div className="detail-chip-grid">
                {coach.specialties.map((speciality) => (
                  <span key={speciality} className="detail-chip">
                    {speciality}
                  </span>
                ))}
              </div>
            </div>
            <div className="coach-detail-section">
              <h3>Coaching Locations</h3>
              <ul className="detail-list">
                {coach.locations.map((location) => (
                  <li key={location}>{location}</li>
                ))}
              </ul>
            </div>
            <div className="coach-detail-section">
              <h3>Available Lesson Types</h3>
              <div className="detail-chip-grid">
                {coach.lessonTypes.map((lesson) => (
                  <span key={lesson} className="detail-chip">
                    {lesson}
                  </span>
                ))}
              </div>
            </div>
            <div className="coach-detail-section availability">
              <h3>Typical availability</h3>
              <p>{coach.availability}</p>
            </div>
          </article>
        ) : (
          <div className="coach-not-found">
            <h2>We couldn&apos;t find that coach</h2>
            <p>They may have been removed or the link is out of date.</p>
            <button type="button" className="cta-button" onClick={handleBack}>
              Browse coaches
            </button>
          </div>
        )}
      </main>
      <ProfileManager isOpen={isProfileManagerOpen} onClose={() => setProfileManagerOpen(false)} />
    </div>
  );
};

export default CoachDetailPage;
