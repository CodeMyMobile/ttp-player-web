import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { getPlayerPersonalDetails, patchPlayerPersonalDetails } from "../api/playerProfile";
import { getStoredAuthToken } from "../services/authToken";
import { parseQuizHandoff } from "../features/ratingQuiz/quizHandoff";
import { hasStoredRating, storeUpdatedProfile } from "../features/ratingQuiz/storedRating";

/**
 * Where the public site's quiz hands its result to the app (see
 * features/ratingQuiz/quizHandoff). Behind ProtectedRoute, so a signed-out
 * player signs in first and the guard brings them back here with the query
 * intact.
 *
 * Saves the level only when the account has none — the same rule that locks
 * the in-app quiz — then goes home either way. The level is a bonus on top of
 * signing in: a failed or skipped save must never strand someone on a spinner.
 */
export default function SaveQuizLevelPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // StrictMode runs effects twice in development; the save must run once.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const save = async () => {
      const payload = parseQuizHandoff(location.search);
      const token = getStoredAuthToken() ?? "";
      if (!payload || !token) return;

      const details = await getPlayerPersonalDetails({ token });
      if (hasStoredRating(details)) return;

      storeUpdatedProfile(await patchPlayerPersonalDetails({ token, body: payload }));
    };

    save()
      .catch((error) => console.error("Couldn't save the quiz level", error))
      .finally(() => navigate("/", { replace: true }));
  }, [location.search, navigate]);

  return <div className="loading-screen">Saving your level…</div>;
}
