import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MatchCreatorFlow from "../components/MatchCreatorFlow";
import MultiMatchCreatorFlow from "../components/MultiMatchCreatorFlow";
import { isMultiMatchEnabled } from "../utils/featureFlags";
import { resolvePlayerLevel } from "../../utils/playerLevel";

const CreateMatchPage = () => {
  const navigate = useNavigate();
  // This route builds its own currentUser rather than going through App.jsx's
  // buildMatchesUser, so a fix applied there does not reach it — which is how the
  // computed NTRP kept failing to populate here after two attempts at the other path.
  //
  // localStorage "user" carries no calculated_ntrp at all; it lives on
  // "playerPersonalDetails" and on "authLoginResponse".profile. resolvePlayerLevel
  // knows every nesting it has been observed at.
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
    const authUser = read("user");
    if (!authUser) return null;
    const skillLevel = resolvePlayerLevel({
      authUser,
      personalDetails: read("playerPersonalDetails"),
      loginResponse: read("authLoginResponse"),
    });
    return skillLevel ? { ...authUser, skillLevel } : authUser;
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
