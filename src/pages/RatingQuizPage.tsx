import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { getPlayerPersonalDetails, patchPlayerPersonalDetails, type PlayerPersonalDetails } from "../api/playerProfile";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";
import {
  activeQuestionIndex,
  activeRatingQuizQuestions,
  buildRatingQuizPayload,
  nudgeTarget,
  scoreRatingQuiz,
  settleEstimate,
  takeNudge,
  type RatingQuizAnswers,
  type SettledLevel,
} from "../features/ratingQuiz/ratingQuizModel";
import { quizReturnPath } from "../features/ratingQuiz/quizReturn";
import { hasStoredRating, positiveNumber, storeUpdatedProfile } from "../features/ratingQuiz/storedRating";
import "./RatingQuizPage.css";

const currentRatingLabel = (details: PlayerPersonalDetails | null) => {
  const rating =
    positiveNumber(details?.usta_rating) ??
    positiveNumber(details?.self_rated_seed) ??
    positiveNumber(details?.calculated_ntrp) ??
    positiveNumber(details?.current_rating);
  return rating === null ? null : rating.toFixed(1);
};

export default function RatingQuizPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // "/" when opened from the home page's "Set my rating", so saving goes back there.
  const returnPath = quizReturnPath(location.search);
  const { user } = useAuth();
  const token = useMemo(() => getStoredAuthToken() ?? "", [user]);
  const [details, setDetails] = useState<PlayerPersonalDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [answers, setAnswers] = useState<RatingQuizAnswers>({});
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  // The half step the player took after "lower/higher than I expected", or null for
  // the quiz's own estimate. See SettledLevel in the shared model.
  const [nudged, setNudged] = useState<SettledLevel | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");

    getPlayerPersonalDetails({ token, signal: controller.signal })
      .then((nextDetails) => setDetails(nextDetails))
      .catch((error) => {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : "We couldn't load your profile.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [token]);

  const questions = activeRatingQuizQuestions(answers);
  const question = questions[index] ?? null;
  const result = useMemo(() => scoreRatingQuiz(answers), [answers]);
  const settled = nudged ?? settleEstimate(result);
  const payload = useMemo(() => buildRatingQuizPayload(answers, nudged), [answers, nudged]);
  const offeredStep = nudgeTarget(result.seed, answers.feedback);
  const showResult = answers.bg === "starting" || index >= questions.length;
  const existingRating = currentRatingLabel(details);
  const locked = hasStoredRating(details);

  const choose = (optionId: string) => {
    if (!question) return;
    setAnswers((current) => ({ ...current, [question.key]: optionId }));
    setIndex((current) => current + 1);
    setSaveError("");
  };

  const goBack = () => {
    if (showResult) {
      // Leaving the result drops the reply to "does that sound right?": it was about
      // this estimate, and changing an answer makes a new one.
      const { feedback: _feedback, ...rest } = answers;
      setNudged(null);
      setSaved(false);
      if (answers.bg === "starting") {
        // The beginner answer ends the quiz on the background question; go back to it.
        const { bg: _bg, ...withoutBackground } = rest;
        setAnswers(withoutBackground);
        setIndex(Math.max(0, activeQuestionIndex(withoutBackground, "bg")));
      } else {
        setAnswers(rest);
        setIndex(Math.max(0, questions.length - 1));
      }
      return;
    }
    if (index === 0) {
      navigate("/");
      return;
    }
    // `questions` is this player's active list, so the step back is always a question
    // they were shown. It used to index the full list, which includes the USTA branch.
    setIndex((current) => Math.max(0, current - 1));
    setSaveError("");
  };

  const skipToDeclared = () => {
    // Keeps the answers already given (the pool question comes first) and finds the
    // USTA question by key rather than assuming it is second.
    const next = { ...answers, bg: "usta" };
    setAnswers(next);
    setIndex(Math.max(0, activeQuestionIndex(next, "usta")));
    setNudged(null);
    setSaved(false);
    setSaveError("");
  };

  const reset = () => {
    setAnswers({});
    setIndex(0);
    setNudged(null);
    setSaved(false);
    setSaveError("");
  };

  // Recorded with the answers, never scored. Only the player taking the offered half
  // step changes the level.
  const giveFeedback = (feedback: "low" | "right" | "high") => {
    setAnswers((current) => ({ ...current, feedback }));
  };

  const answerNudge = (take: boolean) => {
    if (take && offeredStep !== null) {
      setNudged(takeNudge(offeredStep));
    } else {
      setNudged(null);
      setAnswers((current) => ({ ...current, feedback: `${current.feedback}_kept` }));
    }
  };

  // Nothing to confirm for someone who told us their USTA rating, or once it is saved.
  const confirmStep = result.declaredUsta !== null || saved
    ? null
    : !answers.feedback
      ? "ask"
      : answers.feedback === "right" || nudged || answers.feedback.endsWith("_kept") || offeredStep === null
        ? "done"
        : "offer";

  const save = async () => {
    if (!token || saving || locked) return;
    setSaving(true);
    setSaveError("");
    try {
      const nextDetails = await patchPlayerPersonalDetails({ token, body: payload });
      setDetails(nextDetails);
      storeUpdatedProfile(nextDetails);
      setSaved(true);
      if (returnPath) navigate(returnPath, { replace: true });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "We couldn't save your level.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="rq-page rq-page--center">
        <Loader2 className="rq-spin" aria-hidden="true" />
        <p>Loading your profile...</p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="rq-page rq-page--center">
        <h1>We couldn't load your rating</h1>
        <p>{loadError}</p>
        <button className="rq-btn rq-btn--solid" type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </section>
    );
  }

  if (locked && !saved) {
    return (
      <section className="rq-page rq-page--center">
        <CheckCircle2 className="rq-ok" aria-hidden="true" />
        <h1>You already have a rating</h1>
        <p>
          Your current level is {existingRating ? `NTRP ${existingRating}` : "already on your profile"}.
          The quiz is only for players without a saved or match-derived rating.
        </p>
        <div className="rq-actions">
          {returnPath ? (
            <Link className="rq-btn rq-btn--solid" to={returnPath}>Back to home</Link>
          ) : null}
          <Link className={`rq-btn${returnPath ? "" : " rq-btn--solid"}`} to="/leagues">Find leagues</Link>
          <Link className="rq-btn" to="/matches">Find a match</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rq-page">
      <div className="rq-card" id="rating-quiz">
        {!showResult && question ? (
          <>
            <div className="rq-head">
              <button className="rq-back" type="button" aria-label="Back" onClick={goBack}>
                <ChevronLeft size={19} aria-hidden="true" />
              </button>
              <div className="rq-bar" aria-hidden="true">
                <i style={{ width: `${Math.round(((index + 1) / questions.length) * 100)}%` }} />
              </div>
              <span className="rq-count">{index + 1} of {questions.length}</span>
            </div>

            <p className="rq-kicker">Find your level</p>
            <h1 className="rq-question">{question.prompt}</h1>
            <p className="rq-hint">{question.hint}</p>
            <div className="rq-options">
              {question.options.map((option) => (
                <button className="rq-option" type="button" key={option.id} onClick={() => choose(option.id)}>
                  <b>{option.label}</b>
                  {option.detail ? <small>{option.detail}</small> : null}
                </button>
              ))}
            </div>
            <button className="rq-link" type="button" onClick={skipToDeclared}>
              I already know my level
            </button>
          </>
        ) : (
          <div className="rq-result">
            <button className="rq-back rq-result__back" type="button" aria-label="Back" onClick={goBack}>
              <ChevronLeft size={19} aria-hidden="true" />
            </button>
            <p className="rq-lead">Based on your answers, you look like</p>
            <p className="rq-band">NTRP {settled.band}</p>
            <span className={`rq-conf${saved ? " rq-conf--saved" : ""}`}>
              {saved ? `Saved: ${settled.confidence.toLowerCase()}` : settled.confidence}
            </span>
            <p className="rq-why">{result.why}</p>

            {confirmStep === "ask" ? (
              <div className="rq-confirm">
                <p className="rq-confirm__q" id="rq-confirm-q">NTRP {settled.band} — does that sound about right?</p>
                <div className="rq-confirm__opts" role="group" aria-labelledby="rq-confirm-q">
                  <button type="button" onClick={() => giveFeedback("low")}>Lower than I expected</button>
                  <button type="button" onClick={() => giveFeedback("right")}>Sounds right</button>
                  <button type="button" onClick={() => giveFeedback("high")}>Higher than I expected</button>
                </div>
              </div>
            ) : confirmStep === "offer" && offeredStep !== null ? (
              <div className="rq-confirm">
                <p className="rq-confirm__q" id="rq-confirm-q">Want to set it to {offeredStep.toFixed(1)} instead?</p>
                <div className="rq-confirm__opts" role="group" aria-labelledby="rq-confirm-q">
                  <button type="button" onClick={() => answerNudge(true)}>Yes, {offeredStep.toFixed(1)}</button>
                  <button type="button" onClick={() => answerNudge(false)}>No, keep {result.seed.toFixed(1)}</button>
                </div>
              </div>
            ) : confirmStep === "done" ? (
              <p className="rq-confirm__done" role="status">Thanks — that helps us calibrate the quiz.</p>
            ) : null}

            {saved ? (
              <>
                <div className="rq-saved">Added to your profile</div>
                <p className="rq-verify">Play and log one match to turn this into a verified rating.</p>
              </>
            ) : (
              <>
                <button className="rq-btn rq-btn--solid" type="button" onClick={save} disabled={saving}>
                  {saving ? "Saving..." : "Save to my profile"}
                </button>
                <p className="rq-verify">You can change this before match results verify your level.</p>
              </>
            )}

            <div className="rq-recs">
              <p>Where to go next</p>
              {(result.beginner
                ? [
                    ["CO", "Start with a coach", "Beginner-friendly coaches near you", "/my-coaches"],
                    ["GL", "Adult beginner clinic", "Group lessons built for first rallies", "/group-lessons"],
                    ["MP", "Others starting out", "Low-pressure hitting sessions", "/matches"],
                  ]
                : [
                    ["LG", `Fall Flex League ${settled.seed.toFixed(1)}`, "12 weeks with players near your level", "/leagues"],
                    ["GL", `${settled.seed.toFixed(1)} group lessons`, "Weekly clinics at your level", "/group-lessons"],
                    ["CO", `Coaches for ${settled.seed.toFixed(1)} players`, "Sharpen what holds you back", "/my-coaches"],
                  ]
              ).map(([icon, title, subtitle, to]) => (
                <Link className="rq-rec" to={to} key={title}>
                  <span className="rq-rec__icon">{icon}</span>
                  <span>
                    <b>{title}</b>
                    <small>{subtitle}</small>
                  </span>
                  <ChevronRight className="rq-rec__go" size={17} aria-hidden="true" />
                </Link>
              ))}
            </div>

            {saveError ? <p className="rq-error">{saveError}</p> : null}
            <button className="rq-link rq-link--again" type="button" onClick={reset}>
              Take it again
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
