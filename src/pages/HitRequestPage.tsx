import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";

import { answerHitRequest, getHitRequest, type HitRequestView } from "../api/hitRequests";
import { hitRequestErrorCode } from "../hooks/useHitRequest";

import "./HitRequestPage.css";

type PageState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error" }
  | { kind: "ready"; view: HitRequestView };

const initialsOf = (name: string | null) =>
  (name ?? "")
    .replace(/\./g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

/**
 * Where the link in a hit request text lands. No sign-in: the token in the link
 * is the key. Shows who's asking, then Accept or No thanks. On accept the API
 * texts each player the other's number; this page never shows a number.
 */
const HitRequestPage = () => {
  const { token = "" } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [answering, setAnswering] = useState<"accept" | "decline" | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getHitRequest(token)
      .then((view) => {
        if (!cancelled) setState({ kind: "ready", view });
      })
      .catch((caught) => {
        if (cancelled) return;
        const status = (caught as { status?: number } | null)?.status;
        setState({ kind: status === 404 ? "missing" : "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const answer = useCallback(
    async (action: "accept" | "decline") => {
      if (state.kind !== "ready") return;
      setAnswering(action);
      setAnswerError(null);
      try {
        const result = await answerHitRequest(token, action);
        setState({ kind: "ready", view: { ...state.view, status: result.status } });
      } catch (caught) {
        if (hitRequestErrorCode(caught) === "hit_request_expired") {
          setState({ kind: "ready", view: { ...state.view, status: "expired" } });
        } else {
          setAnswerError("Something went wrong. Please try again.");
        }
      } finally {
        setAnswering(null);
      }
    },
    [state, token],
  );

  const body = () => {
    if (state.kind === "loading") {
      return (
        <div className="hit-request__center" aria-live="polite">
          <Loader2 className="hit-request__spinner" size={28} aria-hidden="true" />
          <span className="hit-request__muted">Loading…</span>
        </div>
      );
    }
    if (state.kind === "missing") {
      return (
        <div className="hit-request__center">
          <h1 className="hit-request__title">This link isn't working</h1>
          <p className="hit-request__muted">The request may have been withdrawn, or the link was copied incompletely.</p>
        </div>
      );
    }
    if (state.kind === "error") {
      return (
        <div className="hit-request__center">
          <h1 className="hit-request__title">Couldn't load this request</h1>
          <p className="hit-request__muted">Check your connection and open the link again.</p>
        </div>
      );
    }

    const { view } = state;
    const senderName = view.sender.name ?? "A player";
    const photo = photoFailed ? null : view.sender.profile_picture;

    return (
      <>
        <div className="hit-request__sender">
          {photo ? (
            <img className="hit-request__avatar" src={photo} alt="" onError={() => setPhotoFailed(true)} />
          ) : (
            <span className="hit-request__avatar hit-request__avatar--initials" aria-hidden="true">
              {initialsOf(view.sender.name)}
            </span>
          )}
          {view.sender.level ? <span className="hit-request__level">{view.sender.level}</span> : null}
        </div>

        {view.status === "pending" ? (
          <>
            <h1 className="hit-request__title">{senderName} wants to hit with you</h1>
            <p className="hit-request__muted">
              If you accept, we'll text you each other's numbers so you can set up a time. Your number isn't
              shared unless you accept.
            </p>
            <div className="hit-request__actions">
              <button
                type="button"
                className="hit-request__button hit-request__button--primary"
                onClick={() => void answer("accept")}
                disabled={answering !== null}
              >
                {answering === "accept" ? "Accepting…" : "Accept"}
              </button>
              <button
                type="button"
                className="hit-request__button"
                onClick={() => void answer("decline")}
                disabled={answering !== null}
              >
                {answering === "decline" ? "…" : "No thanks"}
              </button>
            </div>
            {answerError ? (
              <p className="hit-request__error" role="alert">
                {answerError}
              </p>
            ) : null}
          </>
        ) : view.status === "accepted" ? (
          <>
            <CheckCircle2 className="hit-request__check" size={28} aria-hidden="true" />
            <h1 className="hit-request__title">You're connected with {senderName}</h1>
            <p className="hit-request__muted">We've texted you each other's numbers. Have a great hit!</p>
          </>
        ) : view.status === "declined" ? (
          <>
            <h1 className="hit-request__title">No problem</h1>
            <p className="hit-request__muted">We won't let {senderName} know.</p>
          </>
        ) : (
          <>
            <h1 className="hit-request__title">This request has expired</h1>
            <p className="hit-request__muted">Requests last two weeks. You can find {senderName} on The Tennis Plan.</p>
          </>
        )}

        <a className="hit-request__link" href={view.sender.profile_url}>
          View {senderName}'s profile
        </a>
      </>
    );
  };

  return (
    <main className="hit-request">
      <div className="hit-request__card">
        <p className="hit-request__brand">
          The Tennis <em>Plan</em>
        </p>
        {body()}
      </div>
    </main>
  );
};

export default HitRequestPage;
