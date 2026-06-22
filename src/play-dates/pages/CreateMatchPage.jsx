import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MatchCreatorFlow from "../components/MatchCreatorFlow";
import MultiMatchCreatorFlow from "../components/MultiMatchCreatorFlow";
import { isMultiMatchEnabled } from "../utils/featureFlags";

const CreateMatchPage = () => {
  const navigate = useNavigate();
  const [currentUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn("Failed to parse stored user", error);
      return null;
    }
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
