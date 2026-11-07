import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CalendarDays, ChevronRight, Clock } from "lucide-react";

import MainLayout from "../components/MainLayout";
import { notifyMyWeekChanged, useMyWeek } from "../features/myWeek/useMyWeek";
import {
  dayCards,
  dayHeading,
  initialsOf,
  laterLabel,
  loadDots,
  stripLabel,
  timeLabel,
  weekRangeLabel,
  type WeekCard,
} from "../features/myWeek/screenModel";
import type { WeekItem, WeekPerson } from "../features/myWeek/types";
import { typeColor } from "../features/myWeek/typeColors";
import { acceptInvite, rejectInvite } from "../services/invites";

import "./MyWeekPage.css";

const ERROR_LABELS: Record<string, string> = {
  lesson: "lessons",
  match: "matches",
  invite: "invites",
  leagueDue: "league matches",
};

const inviteToken = (item: WeekItem): string | null => {
  const token = (item.raw as { token?: unknown } | null)?.token;
  return typeof token === "string" && token ? token : null;
};

const matchIdOf = (item: WeekItem): string => item.id.slice(item.id.indexOf(":") + 1);

const Avatar = ({ person, waiting = false }: { person: WeekPerson; waiting?: boolean }) => (
  <span className={`my-week__avatar${waiting ? " my-week__avatar--waiting" : ""}`} title={person.name}>
    {person.photoUrl && !waiting ? <img src={person.photoUrl} alt="" /> : initialsOf(person.name)}
  </span>
);

type AnswerState = { busy: "accept" | "decline" | null; error: string | null };

/**
 * My Week: the next seven days, with a day strip on top. Invites the player sent ride on their
 * match's card. Invites waiting on them for later matches sit in a row at the top, so the tab's
 * badge always points at something on this screen.
 */
const MyWeekPage = () => {
  const navigate = useNavigate();
  const { days, later, loading, errors, refetch } = useMyWeek();
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  // /my-week?day=2026-11-09 (Home's day strip) opens at that day, once its section exists.
  const [searchParams] = useSearchParams();
  const requestedDay = searchParams.get("day");
  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    if (!requestedDay || scrolledTo.current === requestedDay || loading) return;
    const section = sectionRefs.current[requestedDay];
    if (!section) return;
    scrolledTo.current = requestedDay;
    section.scrollIntoView({ block: "start" });
  }, [requestedDay, loading, days]);

  const todayKey = days[0]?.dayKey ?? "";
  const tomorrowKey = days[1]?.dayKey ?? "";
  const failed = Object.keys(errors).map((source) => ERROR_LABELS[source] ?? source);
  const isEmpty = !loading && later.length === 0 && days.every((day) => day.items.length === 0);

  const answerInvite = useCallback(async (item: WeekItem, action: "accept" | "decline") => {
    const token = inviteToken(item);
    if (!token) {
      if (item.href) navigate(item.href);
      return;
    }
    setAnswers((current) => ({ ...current, [item.id]: { busy: action, error: null } }));
    try {
      await (action === "accept" ? acceptInvite(token) : rejectInvite(token));
      setAnswers((current) => ({ ...current, [item.id]: { busy: null, error: null } }));
      notifyMyWeekChanged();
    } catch {
      setAnswers((current) => ({
        ...current,
        [item.id]: {
          busy: null,
          error: action === "accept" ? "Couldn't accept this invite." : "Couldn't decline this invite.",
        },
      }));
    }
  }, [navigate]);

  const scrollToDay = (dayKey: string) => {
    sectionRefs.current[dayKey]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const renderInviteActions = (item: WeekItem) => {
    const state = answers[item.id] ?? { busy: null, error: null };
    return (
      <>
        <div className="my-week__actions">
          <button
            type="button"
            className="my-week__btn my-week__btn--primary"
            disabled={state.busy !== null}
            onClick={() => void answerInvite(item, "accept")}
          >
            {state.busy === "accept" ? "Accepting…" : "Accept"}
          </button>
          <button
            type="button"
            className="my-week__btn"
            disabled={state.busy !== null}
            onClick={() => void answerInvite(item, "decline")}
          >
            {state.busy === "decline" ? "Declining…" : "Decline"}
          </button>
        </div>
        {state.error ? (
          <p className="my-week__error" role="alert">
            {state.error}{" "}
            {item.href ? <Link to={item.href}>Open the invite</Link> : null}
          </p>
        ) : null}
      </>
    );
  };

  const renderCard = ({ item, waiting }: WeekCard) => {
    const opensOnTap = item.source !== "invite" && Boolean(item.href);
    return (
      <li
        key={item.id}
        className={`my-week__card${item.needsResponse ? " is-waiting" : ""}`}
        style={{ borderLeftColor: typeColor(item.type) }}
      >
        <div className="my-week__time">
          <Clock size={14} aria-hidden="true" />
          {timeLabel(item)}
        </div>
        <div className="my-week__body">
          {opensOnTap ? (
            <button type="button" className="my-week__title-btn" onClick={() => navigate(item.href as string)}>
              <span className="my-week__title">{item.title}</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <span className="my-week__title">{item.title}</span>
          )}
          {item.subtitle ? <span className="my-week__subtitle">{item.subtitle}</span> : null}
          {item.reason ? <span className="my-week__reason">{item.reason}</span> : null}

          {item.people.length || waiting?.people.length ? (
            <div className="my-week__people">
              {item.people.slice(0, 4).map((person) => (
                <Avatar key={`p-${person.id ?? person.name}`} person={person} />
              ))}
              {(waiting?.people ?? []).slice(0, 3).map((person) => (
                <Avatar key={`w-${person.id ?? person.name}`} person={person} waiting />
              ))}
            </div>
          ) : null}

          {waiting ? (
            <div className="my-week__waiting">
              <span>{waiting.reason}</span>
              {waiting.actions.includes("nudge") ? (
                <button
                  type="button"
                  className="my-week__btn my-week__btn--small"
                  onClick={() => navigate(`/matches/${matchIdOf(waiting)}/invite`)}
                >
                  Nudge
                </button>
              ) : null}
            </div>
          ) : null}

          {item.source === "invite" ? renderInviteActions(item) : null}
          {item.source === "sentInvite" && item.actions.includes("nudge") ? (
            <div className="my-week__actions">
              <button
                type="button"
                className="my-week__btn my-week__btn--small"
                onClick={() => navigate(`/matches/${matchIdOf(item)}/invite`)}
              >
                Nudge
              </button>
            </div>
          ) : null}
          {item.actions.includes("schedule") && item.href ? (
            <div className="my-week__actions">
              <button
                type="button"
                className="my-week__btn my-week__btn--primary"
                onClick={() => navigate(item.href as string)}
              >
                Schedule
              </button>
            </div>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <MainLayout mobileChrome="home">
      <main className="my-week">
        <header className="my-week__header">
          <h1>My Week</h1>
          <p>{weekRangeLabel(days)}</p>
        </header>

        {later.length ? (
          <section className="my-week__later" aria-labelledby="my-week-later">
            <h2 id="my-week-later">Waiting on you · later</h2>
            <ul>
              {later.map((item) => (
                <li key={item.id} className="my-week__later-row">
                  <div>
                    <span className="my-week__later-title">{item.reason ?? item.title}</span>
                    <span className="my-week__later-when">{laterLabel(item)}</span>
                  </div>
                  {renderInviteActions(item)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <nav className="my-week__strip" aria-label="Days this week">
          {days.map((day, index) => {
            const label = stripLabel(day.dayKey, index);
            return (
              <button key={day.dayKey} type="button" className="my-week__day" onClick={() => scrollToDay(day.dayKey)}>
                <span className="my-week__day-top">{label.top}</span>
                <span className="my-week__day-date">
                  {label.date}
                  {day.hasWaiting ? <span className="my-week__day-alert" aria-label="Needs your answer" /> : null}
                </span>
                <span className="my-week__dots" aria-hidden="true">
                  {loadDots(day).map((type, dot) => (
                    <span key={dot} className="my-week__dot" style={{ background: typeColor(type) }} />
                  ))}
                </span>
              </button>
            );
          })}
        </nav>

        {failed.length ? (
          <div className="my-week__failed" role="status">
            <AlertCircle size={16} aria-hidden="true" />
            <span>Couldn&apos;t load your {failed.join(" and ")}.</span>
            <button type="button" onClick={refetch}>
              Retry
            </button>
          </div>
        ) : null}

        {loading && days.every((day) => day.items.length === 0) ? (
          <div className="my-week__loading" aria-live="polite">
            <span className="my-week__skeleton" />
            <span className="my-week__skeleton" />
            <span className="my-week__skeleton" />
          </div>
        ) : isEmpty ? (
          <div className="my-week__empty">
            <CalendarDays size={28} aria-hidden="true" />
            <h2>Nothing this week</h2>
            <p>Find a match or book a lesson to fill it up.</p>
            <div className="my-week__actions my-week__actions--center">
              <Link className="my-week__btn my-week__btn--primary" to="/matches">
                Find a match
              </Link>
              <Link className="my-week__btn" to="/find-coaches">
                Book a lesson
              </Link>
            </div>
          </div>
        ) : (
          days.map((day) => (
            <section
              key={day.dayKey}
              className="my-week__section"
              ref={(node) => {
                sectionRefs.current[day.dayKey] = node;
              }}
              aria-labelledby={`my-week-${day.dayKey}`}
            >
              <h2 id={`my-week-${day.dayKey}`} className="my-week__section-title">
                {dayHeading(day.dayKey, todayKey, tomorrowKey)}
              </h2>
              {day.items.length ? (
                <ul className="my-week__cards">{dayCards(day.items).map(renderCard)}</ul>
              ) : (
                <p className="my-week__nothing">Nothing planned</p>
              )}
            </section>
          ))
        )}

        <Link className="my-week__past" to="/my-week/past">
          Past
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </main>
    </MainLayout>
  );
};

export default MyWeekPage;
