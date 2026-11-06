import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, CalendarDays, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

import {
  answerCoachLessonRequest,
  experienceLabel,
  getCoachLessonRequest,
  goalLabel,
  lessonRequestErrorCode,
  timeOfDayLabel,
  type LessonRequestView,
} from "../api/coachLessonRequests";

import "./CoachLessonRequestPage.css";

type PageState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error" }
  | { kind: "ready"; view: LessonRequestView };

// The player's answer, as the coach reads it.
const FOR_WHOM: Record<string, string> = { my_child: "their child", someone_else: "someone else" };

const initialsOf = (name: string | null) =>
  (name ?? "")
    .replace(/\./g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

/**
 * Where the link in a coach's lesson request text and email lands. No sign-in: the token in
 * the link is the key. Shows the player's answers beside the coach's open times. "I'm
 * interested" stays off until the coach ticks that their calendar is up to date, and while
 * they have no open times, because the player is then texted a link to book one.
 */
const CoachLessonRequestPage = () => {
  const { token = "" } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [calendarConfirmed, setCalendarConfirmed] = useState(false);
  const [answering, setAnswering] = useState<"accept" | "decline" | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [playerPhone, setPlayerPhone] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "refresh") setRefreshing(true);
      try {
        const view = await getCoachLessonRequest(token);
        setState({ kind: "ready", view });
      } catch (caught) {
        if (mode === "refresh") return;
        const status = (caught as { status?: number } | null)?.status;
        setState({ kind: status === 404 ? "missing" : "error" });
      } finally {
        if (mode === "refresh") setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void load("initial");
  }, [load]);

  // Coming back from the coach portal: show the times as they are now.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && state.kind === "ready" && state.view.status === "pending") {
        void load("refresh");
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load, state]);

  const answer = useCallback(
    async (action: "accept" | "decline") => {
      if (state.kind !== "ready") return;
      setAnswering(action);
      setAnswerError(null);
      try {
        const result = await answerCoachLessonRequest(token, action, { calendarConfirmed });
        if (result.player_phone) setPlayerPhone(result.player_phone);
        setState({ kind: "ready", view: { ...state.view, status: result.status } });
        if (result.status === "accepted" && !result.player_phone) void load("refresh");
      } catch (caught) {
        const code = lessonRequestErrorCode(caught);
        if (code === "lesson_request_expired") {
          setState({ kind: "ready", view: { ...state.view, status: "expired" } });
        } else if (code === "no_open_times") {
          setAnswerError("You don't have any open times right now. Add some in the coach portal, then come back.");
          void load("refresh");
        } else if (code === "calendar_not_confirmed") {
          setAnswerError("Tick the box to confirm your calendar is up to date.");
        } else {
          setAnswerError("Something went wrong. Please try again.");
        }
      } finally {
        setAnswering(null);
      }
    },
    [calendarConfirmed, load, state, token],
  );

  const body = () => {
    if (state.kind === "loading") {
      return (
        <div className="coach-request__center" aria-live="polite">
          <Loader2 className="coach-request__spinner" size={28} aria-hidden="true" />
          <span className="coach-request__muted">Loading…</span>
        </div>
      );
    }
    if (state.kind === "missing") {
      return (
        <div className="coach-request__center">
          <h1 className="coach-request__title">This link isn't working</h1>
          <p className="coach-request__muted">The link may have been copied incompletely.</p>
        </div>
      );
    }
    if (state.kind === "error") {
      return (
        <div className="coach-request__center">
          <h1 className="coach-request__title">Couldn't load this request</h1>
          <p className="coach-request__muted">Check your connection and open the link again.</p>
        </div>
      );
    }

    const { view } = state;
    const playerName = view.player.name ?? "A player";
    const playerFirst = playerName.split(" ")[0];
    const photo = photoFailed ? null : view.player.profile_picture;
    const forWhom = FOR_WHOM[view.request.who_for] ? ` for ${FOR_WHOM[view.request.who_for]}` : "";
    const answers: [string, string][] = [
      [
        "Lessons for",
        view.request.who_for === "my_child"
          ? `${playerFirst}'s child`
          : view.request.who_for === "someone_else"
            ? "Someone else"
            : playerName,
      ],
      ["Experience", experienceLabel(view.request.experience)],
      ["Looking to", view.request.goals.map(goalLabel).join(", ")],
      ["Best times", view.request.times_of_day.map(timeOfDayLabel).join(", ")],
      ...(view.request.note ? ([["Note", view.request.note]] as [string, string][]) : []),
    ];
    const header = (
      <div className="coach-request__player">
        {photo ? (
          <img className="coach-request__avatar" src={photo} alt="" onError={() => setPhotoFailed(true)} />
        ) : (
          <span className="coach-request__avatar coach-request__avatar--initials" aria-hidden="true">
            {initialsOf(view.player.name)}
          </span>
        )}
      </div>
    );

    if (view.status === "accepted") {
      const phone = playerPhone ?? view.player.phone;
      return (
        <div className="coach-request__center">
          <CheckCircle2 className="coach-request__check" size={32} aria-hidden="true" />
          <h1 className="coach-request__title">You're connected with {playerName}</h1>
          <p className="coach-request__muted">
            We've texted {playerFirst} a link to book one of your open times, and your number.
            {phone ? ` You can reach them at ${phone}.` : ""}
          </p>
          <a className="coach-request__link" href={view.coach.calendar_url}>
            Open the coach portal
          </a>
        </div>
      );
    }
    if (view.status === "declined") {
      return (
        <div className="coach-request__center">
          <h1 className="coach-request__title">Thanks for letting us know</h1>
          <p className="coach-request__muted">We've let {playerFirst} know and pointed them to other coaches.</p>
        </div>
      );
    }
    if (view.status === "expired") {
      return (
        <div className="coach-request__center">
          <h1 className="coach-request__title">This request has expired</h1>
          <p className="coach-request__muted">Requests stay open for two weeks.</p>
        </div>
      );
    }

    const noTimes = view.open_count === 0;
    const canAccept = calendarConfirmed && !noTimes && answering === null && !refreshing;

    return (
      <>
        {header}
        <h1 className="coach-request__title">
          {playerName} would like lessons{forWhom}
        </h1>
        <p className="coach-request__muted">Found you on The Tennis Plan.</p>

        <dl className="coach-request__answers">
          {answers.map(([label, value]) => (
            <div key={label} className="coach-request__answer">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <section className="coach-request__times" aria-labelledby="coach-request-times">
          <div className="coach-request__times-head">
            <h2 id="coach-request-times">
              <CalendarDays size={16} aria-hidden="true" /> Your open times, next 2 weeks
            </h2>
            <button
              type="button"
              className="coach-request__refresh"
              onClick={() => void load("refresh")}
              disabled={refreshing}
              aria-label="Refresh open times"
            >
              <RefreshCw size={14} className={refreshing ? "coach-request__spinner" : undefined} aria-hidden="true" />
            </button>
          </div>
          <p className="coach-request__step">
            {playerFirst} will be sent a link to book one of these. Make sure they're right before you say yes.
          </p>

          {noTimes ? (
            <div className="coach-request__warning" role="status">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>
                You have no open times in the next two weeks. Add some in the coach portal, or {playerFirst} will have
                nothing to book.
              </span>
            </div>
          ) : (
            <>
              <ul className="coach-request__days">
                {view.open_times.map((day) => (
                  <li key={day.date} className="coach-request__day">
                    <span className="coach-request__day-label">{day.label}</span>
                    <span className="coach-request__slots">
                      {day.slots.map((slot) => (
                        <span
                          key={`${day.date}-${slot.time}`}
                          className={`coach-request__slot${slot.matches_preference ? " is-match" : ""}`}
                          title={slot.location ?? undefined}
                        >
                          {slot.time}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              {view.open_times.some((day) => day.slots.some((slot) => slot.matches_preference)) ? (
                <p className="coach-request__legend">
                  <span className="coach-request__slot is-match">Purple</span> times suit {playerFirst}.
                </p>
              ) : (
                <p className="coach-request__legend">None of these fall in {playerFirst}'s preferred times.</p>
              )}
            </>
          )}

          <a className="coach-request__calendar" href={view.coach.calendar_url} target="_blank" rel="noreferrer">
            Update my calendar
          </a>
          <p className="coach-request__hint">Opens the coach portal. Go to Calendar, then come back here.</p>
        </section>

        <label className={`coach-request__confirm${noTimes ? " is-disabled" : ""}`}>
          <input
            type="checkbox"
            checked={calendarConfirmed && !noTimes}
            disabled={noTimes}
            onChange={(event) => setCalendarConfirmed(event.target.checked)}
          />
          <span>My calendar is up to date. These are times I can teach.</span>
        </label>

        <div className="coach-request__actions">
          <button
            type="button"
            className="coach-request__button coach-request__button--primary"
            onClick={() => void answer("accept")}
            disabled={!canAccept}
          >
            {answering === "accept" ? "Sending…" : "I'm interested"}
          </button>
          <button
            type="button"
            className="coach-request__button"
            onClick={() => void answer("decline")}
            disabled={answering !== null}
          >
            {answering === "decline" ? "…" : "Not right now"}
          </button>
        </div>
        {answerError ? (
          <p className="coach-request__error" role="alert">
            {answerError}
          </p>
        ) : null}
        <p className="coach-request__hint">
          Saying yes texts {playerFirst} a link to book with you and shares your numbers with each other.
        </p>
      </>
    );
  };

  return (
    <main className="coach-request">
      <div className="coach-request__card">
        <p className="coach-request__brand">
          The Tennis <em>Plan</em>
        </p>
        {body()}
      </div>
    </main>
  );
};

export default CoachLessonRequestPage;
