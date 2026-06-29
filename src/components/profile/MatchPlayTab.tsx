import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, ClipboardList, PencilLine, RefreshCcw, Target } from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import {
  deleteUserAnswers,
  getAllSurveyQuestion,
  getAllSurveyQuestionAnswered,
} from "../../api/playerHome";
import { getStoredAuthToken } from "../../services/authToken";
import {
  extractSurveyQuestions,
  formatSurveyAnswer,
  hasSurveyAnswer,
  type NormalizedSurveyQuestion,
} from "../../utils/surveyQuestionnaire";

// Match play tab content — saved matchmaking answers + edit/remove actions.
// Moved verbatim from PlayerMatchProfilePage (logic and markup unchanged); the
// outer MainLayout / settings-page wrappers now come from the hub. Restyle is a
// later PR — do not change behaviour here.
const MatchPlayTab = () => {
  const location = useLocation();
  const { user } = useAuth();
  const storedToken = getStoredAuthToken({ defaultScheme: "token", preferScheme: "token" });
  const playerToken =
    user?.session?.access_token ?? user?.access_token ?? user?.token ?? storedToken ?? null;

  const [questions, setQuestions] = useState<NormalizedSurveyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnsweredQuestions = async (nextMode: "initial" | "refresh" = "initial") => {
    if (!playerToken) {
      setQuestions([]);
      setError("Please sign in to view your match profile.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (nextMode === "initial") setLoading(true);
    if (nextMode === "refresh") setRefreshing(true);
    setError(null);

    try {
      const [allQuestionsResponse, answeredResponse] = await Promise.all([
        getAllSurveyQuestion({ token: playerToken }),
        getAllSurveyQuestionAnswered({ token: playerToken }),
      ]);

      const allQuestions = extractSurveyQuestions(allQuestionsResponse);
      const answeredQuestions = extractSurveyQuestions(answeredResponse);
      const answeredById = new Map(
        answeredQuestions.map((question) => [String(question.questionId), question]),
      );

      const mergedQuestions =
        allQuestions.length > 0
          ? allQuestions.map((question) => {
              const answered = answeredById.get(String(question.questionId));
              return answered ? { ...question, ...answered } : question;
            })
          : answeredQuestions;

      setQuestions(mergedQuestions);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "We couldn't load your match profile right now.",
      );
      setQuestions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnsweredQuestions();
  }, [playerToken]);

  const { answeredQuestions, hasUnansweredQuestions } = useMemo(() => {
    const answered = questions.filter((question) => hasSurveyAnswer(question));
    const missing = questions.some((question) => question.answerRequired && !hasSurveyAnswer(question));
    return {
      answeredQuestions: answered,
      hasUnansweredQuestions: missing,
    };
  }, [questions]);

  const handleRemoveFromSearch = async () => {
    if (!playerToken || removing) return;
    const confirmed = window.confirm(
      "Are you sure you want to remove your player match profile data from search?",
    );
    if (!confirmed) return;

    setRemoving(true);
    setError(null);
    try {
      await deleteUserAnswers({ token: playerToken });
      await loadAnsweredQuestions("refresh");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "We couldn't remove your profile data right now.",
      );
    } finally {
      setRemoving(false);
    }
  };

  const savedMessage =
    location.state && typeof location.state === "object" && "saved" in location.state
      ? "Your player match profile is live."
      : null;

  return (
    <>
      <header className="settings-hero settings-hero--match">
        <span className="settings-hero__badge">
          <Target size={16} aria-hidden="true" />
          Match preferences
        </span>
        <h1 className="settings-hero__title">Match play</h1>
        <p className="settings-hero__subtitle">
          Review the answers used to match you with other players, then update them whenever your availability or preferences change.
        </p>
      </header>

      {savedMessage ? (
        <div className="match-profile-banner match-profile-banner--success">{savedMessage}</div>
      ) : null}

      {hasUnansweredQuestions ? (
        <div className="match-profile-banner match-profile-banner--warning">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>You have new questions to answer.</strong>
            <p>Complete them to improve your match results and visibility in search.</p>
          </div>
          <Link to="/settings/match-profile/edit" className="match-profile-banner__action">
            Edit my player match profile
          </Link>
        </div>
      ) : null}

      <section className="settings-section">
        <div className="match-profile-view">
          <div className="settings-card">
            <div className="match-profile-view__header">
              <div>
                <h2 className="settings-card__title">Saved answers</h2>
                <p className="settings-card__subtitle">
                  This is the information other matchmaking flows use when building suggestions.
                </p>
              </div>
              <div className="match-profile-view__header-actions">
                <button
                  type="button"
                  className="match-profile-inline-button"
                  onClick={() => loadAnsweredQuestions("refresh")}
                  disabled={refreshing || loading}
                >
                  <RefreshCcw size={16} aria-hidden="true" />
                  {refreshing ? "Refreshing…" : "Refresh"}
                </button>
                <Link to="/settings/match-profile/edit" className="match-profile-inline-button match-profile-inline-button--primary">
                  <PencilLine size={16} aria-hidden="true" />
                  {answeredQuestions.length > 0 ? "Edit profile" : "Create profile"}
                </Link>
              </div>
            </div>

            {loading ? (
              <div className="match-profile-empty">
                <ClipboardList size={28} aria-hidden="true" />
                <h3>Loading your answers…</h3>
              </div>
            ) : error ? (
              <div className="match-profile-empty match-profile-empty--error">
                <AlertTriangle size={28} aria-hidden="true" />
                <h3>Unable to load your profile</h3>
                <p>{error}</p>
              </div>
            ) : answeredQuestions.length > 0 ? (
              <>
                <div className="match-profile-answer-list">
                  {answeredQuestions.map((item) => (
                    <article key={String(item.questionId)} className="match-profile-answer-card">
                      <p className="match-profile-answer-card__label">{item.questionText}</p>
                      <pre className="match-profile-answer-card__value">{formatSurveyAnswer(item)}</pre>
                    </article>
                  ))}
                </div>
                {!hasUnansweredQuestions ? (
                  <div className="match-profile-danger-zone">
                    <div>
                      <h3>Remove me from search</h3>
                      <p>
                        This removes your saved player match profile answers so you no longer appear in player matching based on this questionnaire.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="match-profile-inline-button match-profile-inline-button--danger"
                      onClick={handleRemoveFromSearch}
                      disabled={removing}
                    >
                      {removing ? "Removing…" : "Remove Me from Search"}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="match-profile-empty">
                <ClipboardList size={28} aria-hidden="true" />
                <h3>No answers available yet</h3>
                <p>Create your player match profile to start showing up in matchmaking results.</p>
                <Link to="/settings/match-profile/edit" className="match-profile-inline-button match-profile-inline-button--primary">
                  Build my match profile
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
};

export default MatchPlayTab;
