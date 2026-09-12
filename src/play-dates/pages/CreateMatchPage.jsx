import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MatchCreatorFlow from "../components/MatchCreatorFlow";
import MultiMatchCreatorFlow from "../components/MultiMatchCreatorFlow";
import { isMultiMatchEnabled } from "../utils/featureFlags";
import { buildLevelAwareUser } from "../../utils/playerLevel";

const CreateMatchPage = () => {
  const navigate = useNavigate();
  // Built from all three stores rather than from localStorage "user" alone.
  //
  // This route does not go through App.jsx's buildMatchesUser, so fixes applied there
  // never reached it. And "user" on its own is not enough: it carries no
  // calculated_ntrp (that lives on "playerPersonalDetails" and on
  // "authLoginResponse".profile), and it may be absent entirely — in which case
  // requiring it left MultiMatchCreatorFlow with no level *and* no host id, since it
  // reads both off currentUser.
  //
  // Merge order puts "user" last so it still wins wherever it has a value; the other
  // two only fill gaps. `profile` is populated for the host-id lookup at
  // MultiMatchCreatorFlow:181-184, which expects a nested object.
  const [currentUser] = useState(() => {
    const read = (key) => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        console.warn(`Failed to parse stored ${key}`, error);
        return null;
      }
    };
    return buildLevelAwareUser({
      authUser: read("user"),
      personalDetails: read("playerPersonalDetails"),
      loginResponse: read("authLoginResponse"),
    });
  });

  useEffect(() => {
    if (!localStorage.getItem("authToken")) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const handleCancel = () => {
    navigate(-1);
  };

  const handleReturnHome = () => {
    navigate("/", { replace: true });
  };

  const Flow = isMultiMatchEnabled() ? MultiMatchCreatorFlow : MatchCreatorFlow;

  return (
    <div className="playdates-create-page min-h-screen bg-gradient-to-br from-gray-50 via-white to-green-50/30 py-8 overflow-x-hidden">
      <Flow
        currentUser={currentUser}
        onCancel={handleCancel}
        onReturnHome={handleReturnHome}
        onMatchCreated={() => {}}
        onCreateGroup={() => navigate("/groups/new")}
      />
    </div>
  );
};

export default CreateMatchPage;
