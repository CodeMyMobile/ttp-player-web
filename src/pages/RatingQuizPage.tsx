import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { getPlayerPersonalDetails, patchPlayerPersonalDetails, type PlayerPersonalDetails } from "../api/playerProfile";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";
import {
  activeRatingQuizQuestions,
  buildRatingQuizPayload,
  ratingQuizQuestions,
  scoreRatingQuiz,
  type RatingQuizAnswers,
} from "../features/ratingQuiz/ratingQuizModel";
import "./RatingQuizPage.css";

const toNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const hasStoredRating = (details: PlayerPersonalDetails | null) =>
  Boolean(
    toNumber(details?.calculated_ntrp) ||
      toNumber(details?.current_rating) ||
      toNumber(details?.self_rated_seed) ||
      toNumber(details?.usta_rating),
  );

const currentRatingLabel = (details: PlayerPersonalDetails | null) => {
  const rating =
    toNumber(details?.calculated_ntrp) ??
    toNumber(details?.current_rating) ??
    toNumber(details?.self_rated_seed) ??
    toNumber(details?.usta_rating);
  return rating === null ? null : rating.toFixed(1);
};

const storeUpdatedProfile = (details: PlayerPersonalDetails) => {
  try {
    localStorage.setItem("playerPersonalDetails", JSON.stringify(details));
    window.dispatchEvent(new StorageEvent("storage", { key: "playerPersonalDetails" }));
  } catch {
    // Best effort. The saved response still drives this page.
  }
};

export default function RatingQuizPage() {
  const navigate = useNavigate();
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
  const payload = useMemo(() => buildRatingQuizPayload(answers), [answers]);
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
      if (answers.bg === "starting") {
        setAnswers({});
        setIndex(0);
      } else {
        setIndex(Math.max(0, questions.length - 1));
      }
      setSaved(false);
      return;
    }
    if (index === 0) {
      navigate("/");
      return;
    }
    setIndex((current) => {
      const next = Math.max(0, current - 1);
      return ratingQuizQuestions[next]?.branch && answers.bg !== "usta" ? Math.max(0, next - 1) : next;
    });
    setSaveError("");
  };

  const skipToDeclared = () => {
    setAnswers({ bg: "usta" });
    setIndex(1);
    setSaved(false);
    setSaveError("");
  };

  const reset = () => {
    setAnswers({});
    setIndex(0);
    setSaved(false);
    setSaveError("");
  };

  const save = async () => {
    if (!token || saving || locked) return;
    setSaving(true);
    setSaveError("");
    try {
      const nextDetails = await patchPlayerPersonalDetails({ token, body: payload });
      setDetails(nextDetails);
      storeUpdatedProfile(nextDetails);
      setSaved(true);
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
          <Link className="rq-btn rq-btn--solid" to="/leagues">Find leagues</Link>
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
            <p className="rq-band">NTRP {result.band}</p>
            <span className={`rq-conf${saved ? " rq-conf--saved" : ""}`}>
              {saved ? `Saved: ${result.confidence.toLowerCase()}` : result.confidence}
            </span>
            <p className="rq-why">{result.why}</p>

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
                    ["LG", `Fall Flex League ${result.seed.toFixed(1)}`, "12 weeks with players near your level", "/leagues"],
                    ["GL", `${result.seed.toFixed(1)} group lessons`, "Weekly clinics at your level", "/group-lessons"],
                    ["CO", `Coaches for ${result.seed.toFixed(1)} players`, "Sharpen what holds you back", "/my-coaches"],
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
