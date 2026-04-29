import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Target } from "lucide-react";

import MainLayout from "../components/MainLayout";
import SimpleSurvey from "../components/questionnaire/SimpleSurvey";
import { useAuth } from "../context/AuthContext";
import {
  getAllSurveyQuestion,
  getAllSurveyQuestionAnswered,
  submitSurveyAnswers,
} from "../api/playerHome";
import { getStoredAuthToken } from "../services/authToken";
import {
  buildSurveySubmissionPayload,
  extractSurveyQuestions,
  type NormalizedSurveyQuestion,
} from "../utils/surveyQuestionnaire";

import "./PlayerSettingsPages.css";

const PlayerMatchProfileEditPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const storedToken = getStoredAuthToken({ defaultScheme: "token", preferScheme: "token" });
  const playerToken =
    user?.session?.access_token ?? user?.access_token ?? user?.token ?? storedToken ?? null;

  const [questions, setQuestions] = useState<NormalizedSurveyQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pendingAnswers, setPendingAnswers] = useState<Array<Record<string, unknown>>>([]);

  const loadQuestions = async () => {
    if (!playerToken) {
      setError("Please sign in to edit your match profile.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const routeSurvey =
        location.state && typeof location.state === "object" && "survey" in location.state
          ? extractSurveyQuestions((location.state as { survey?: unknown }).survey)
          : [];

      if (routeSurvey.length > 0) {
        setQuestions(routeSurvey);
        return;
      }

      try {
        const answered = await getAllSurveyQuestionAnswered({ token: playerToken });
        const answeredQuestions = extractSurveyQuestions(answered);
        if (answeredQuestions.length > 0) {
          setQuestions(answeredQuestions);
          return;
        }
      } catch {
        // fall through to the base survey questions
      }

      const survey = await getAllSurveyQuestion({ token: playerToken });
      setQuestions(extractSurveyQuestions(survey));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "We couldn't load the survey right now.",
      );
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, [playerToken]);

  const totalQuestions = questions.length;
  const progress = totalQuestions > 0 ? Math.round(((currentQuestionIndex + 1) / totalQuestions) * 100) : 0;

  const questionsMissingOptions = useMemo(
    () =>
      questions.filter(
        (question) =>
          (question.questionType === "SelectionGroup" ||
            question.questionType === "MultipleSelectionGroup" ||
            question.questionType === "ConditionalSelectionWithText") &&
          question.options.length === 0,
      ),
    [questions],
  );

  const handleSurveyFinished = (answers: Array<Record<string, unknown>>) => {
    const prepared = buildSurveySubmissionPayload(answers, questions);
    setPendingAnswers(prepared);
    setReviewOpen(true);
  };

  const handleSubmit = async () => {
    if (!playerToken || pendingAnswers.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await submitSurveyAnswers({
        token: playerToken,
        surveyAnswers: pendingAnswers,
      });
      navigate("/settings/match-profile", { replace: true, state: { saved: true } });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "We couldn't save your match profile right now.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="settings-page">
        <div className="settings-page__inner">
          <header className="settings-hero settings-hero--match">
            <span className="settings-hero__badge">
              <Target size={16} aria-hidden="true" />
              Match preferences
            </span>
            <h1 className="settings-hero__title">Edit player match profile</h1>
            <p className="settings-hero__subtitle">
              Answer the questionnaire used by player matching so your profile is searchable and your recommendations improve over time.
            </p>
          </header>

          <section className="settings-section">
            <div className="settings-card">
              <div className="match-profile-edit__header">
                <div>
                  <h2 className="settings-card__title">Questionnaire</h2>
                  <p className="settings-card__subtitle">
                    Question {totalQuestions > 0 ? currentQuestionIndex + 1 : 0} of {totalQuestions}
                  </p>
                </div>
                <div className="match-profile-progress">
                  <div className="match-profile-progress__track">
                    <div className="match-profile-progress__bar" style={{ width: `${progress}%` }} />
                  </div>
                  <span>{progress}% complete</span>
                </div>
              </div>

              {questionsMissingOptions.length > 0 ? (
                <div className="match-profile-banner match-profile-banner--warning">
                  <AlertTriangle size={18} aria-hidden="true" />
                  <div>
                    <strong>Some selection questions are missing option data.</strong>
                    <p>
                      I can render them once you share the option source for
                      {` ${questionsMissingOptions.map((item) => `"${item.questionText}"`).join(", ")}.`}
                    </p>
                  </div>
                </div>
              ) : null}

              {loading ? (
                <div className="match-profile-empty">
                  <Target size={28} aria-hidden="true" />
                  <h3>Loading questionnaire…</h3>
                </div>
              ) : error ? (
                <div className="match-profile-empty match-profile-empty--error">
                  <AlertTriangle size={28} aria-hidden="true" />
                  <h3>Unable to load the questionnaire</h3>
                  <p>{error}</p>
                </div>
              ) : questions.length > 0 ? (
                <SimpleSurvey
                  survey={questions}
                  onSurveyFinished={handleSurveyFinished}
                  onCurrentQuestionIndexChange={setCurrentQuestionIndex}
                  renderQuestionText={(questionText, questionSubtext) => (
                    <div className="simple-survey__prompt">
                      <h2 className="simple-survey__title">{questionText}</h2>
                      {questionSubtext ? <p className="simple-survey__subtitle">{questionSubtext}</p> : null}
                    </div>
                  )}
                />
              ) : (
                <div className="match-profile-empty">
                  <Target size={28} aria-hidden="true" />
                  <h3>No questionnaire available</h3>
                  <p>Once the survey API returns questions, they will appear here.</p>
                </div>
              )}
            </div>
          </section>

          {reviewOpen ? (
            <div className="match-profile-modal">
              <div className="match-profile-modal__card">
                <div className="match-profile-modal__icon">
                  <CheckCircle2 size={24} aria-hidden="true" />
                </div>
                <h2>Before we publish your profile</h2>
                <p>
                  By signing up to this service you agree to share your contact details with other Tennis Plan users.
                  You also agree to our terms of use. You can remove yourself from the player match listing at any time from profile settings.
                </p>
                <div className="match-profile-modal__actions">
                  <button
                    type="button"
                    className="match-profile-inline-button"
                    onClick={() => setReviewOpen(false)}
                    disabled={saving}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="match-profile-inline-button match-profile-inline-button--primary"
                    onClick={handleSubmit}
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Agree & Save"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="settings-save">
            <Link to="/settings/match-profile" className="match-profile-inline-button">
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default PlayerMatchProfileEditPage;
