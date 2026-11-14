import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";

import { getPick, noneWork, pickTime, type PickLocation, type PickPage } from "../api/leaguePicks";
import { downloadICSFile } from "../play-dates/utils/calendar";
import { ANALYTICS_EVENTS, track } from "../utils/analytics";
import { formatProposedTime } from "../utils/leagueArrange";

import "./LeagueArrangePage.css";

type View =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "page"; page: PickPage }
  | { kind: "picked"; page: PickPage; start: string; location: PickLocation }
  | { kind: "none"; page: PickPage };

const directionsHref = (location: PickLocation) => {
  const query =
    location.latitude != null && location.longitude != null
      ? `${location.latitude},${location.longitude}`
      : location.location_text || "";
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
};

const MATCH_MINUTES = 120;

/**
 * The pick-a-time page behind the league proposal text (home v2, §6.3). No sign-in and no install:
 * the token in the link is the key (ttp-api #461). One tap on a time confirms it; "None of these
 * work" tells the proposer. Then: the match, Add to calendar and Directions (§6.4).
 */
const LeaguePickPage = () => {
  const { token = "" } = useParams();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getPick({ token, signal: controller.signal })
      .then((page) => {
        if (controller.signal.aborted) return;
        if (page.status === "picked" && page.start_date_time) {
          setView({ kind: "picked", page, start: page.start_date_time, location: page.location });
        } else {
          setView({ kind: "page", page });
        }
        if (page.status === "open") track(ANALYTICS_EVENTS.leagueInviteOpened);
      })
      .catch(() => {
        if (!controller.signal.aborted) setView({ kind: "missing" });
      });
    return () => controller.abort();
  }, [token]);

  const choose = async (page: PickPage, time: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await pickTime({ token, time });
      track(ANALYTICS_EVENTS.leagueTimeConfirmed);
      setView({ kind: "picked", page, start: result.start_date_time, location: result.location });
    } catch (err) {
      const code = (err as { data?: { error?: string } })?.data?.error;
      setError(
        code === "pick_link_used" || code === "proposal_closed"
          ? "This has already been answered, or the times were changed."
          : code === "pick_link_expired"
            ? "These times have expired."
            : "Couldn't save that. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const decline = async (page: PickPage) => {
    setBusy(true);
    setError(null);
    try {
      await noneWork({ token, note: note.trim() || undefined });
      setView({ kind: "none", page });
    } catch {
      setError("Couldn't send that. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const shell = (children: ReactNode) => (
    <div className="arrange-page arrange-page--public">
      <p className="arrange-page__lede">The Tennis Plan</p>
      {children}
    </div>
  );

  if (view.kind === "loading") return shell(<div className="arrange-skeleton" aria-busy="true" />);
  if (view.kind === "missing") {
    return shell(
      <>
        <h1 className="arrange-page__title">This link doesn't work</h1>
        <p className="arrange-page__lede">Ask your opponent to send the times again.</p>
      </>,
    );
  }

  const { page } = view;
  const proposer = page.proposer_first_name || "Your opponent";
  const leagueName = page.league?.name || "league";
  const timeZone = page.timezone || undefined;
  const place = page.location.location_text;

  if (view.kind === "picked") {
    const start = new Date(view.start);
    const directions = directionsHref(view.location);
    return shell(
      <section className="pick-card" aria-label="Match on">
        <p className="pick-card__eyebrow">Match on</p>
        <p className="pick-card__when">{formatProposedTime(view.start, timeZone)}</p>
        <p className="pick-card__who">
          You vs {proposer}
          {view.location.location_text ? ` · ${view.location.location_text}` : ""}
        </p>
        <div className="pick-actions">
          <button
            type="button"
            onClick={() =>
              downloadICSFile(
                {
                  title: `${leagueName} match vs ${proposer}`,
                  location: view.location.location_text || "",
                  start,
                  end: new Date(start.getTime() + MATCH_MINUTES * 60000),
                },
                "league-match.ics",
              )
            }
          >
            Add to calendar
          </button>
          {directions ? (
            <a href={directions} target="_blank" rel="noopener noreferrer">
              Directions
            </a>
          ) : null}
        </div>
      </section>,
    );
  }

  if (view.kind === "none") {
    return shell(
      <>
        <h1 className="arrange-page__title">Thanks</h1>
        <p className="arrange-page__lede">We've told {proposer} none of those work. They can send new times.</p>
      </>,
    );
  }

  if (page.status !== "open") {
    return shell(
      <>
        <h1 className="arrange-page__title">
          {page.status === "expired" ? "These times have expired" : page.status === "none" ? "Already answered" : "These times were changed"}
        </h1>
        <p className="arrange-page__lede">Open the app to see your league match.</p>
      </>,
    );
  }

  return shell(
    <>
      <h1 className="arrange-page__title">{proposer} wants to play your {leagueName} match</h1>
      <p className="arrange-page__lede">{place ? `At ${place}. ` : ""}Tap a time to confirm it.</p>
      <div className="pick-times">
        {page.times.map((time, index) => (
          <button
            key={time}
            type="button"
            className={`pick-time${index === 0 ? "" : " is-outline"}`}
            disabled={busy}
            onClick={() => void choose(page, time)}
          >
            {formatProposedTime(time, timeZone)}
          </button>
        ))}
      </div>
      {error ? <p className="arrange-note" role="alert">{error}</p> : null}
      {noteOpen ? (
        <>
          <label className="sr-only" htmlFor="pick-note">Note for {proposer}</label>
          <textarea
            id="pick-note"
            className="pick-note"
            maxLength={200}
            placeholder={`Optional: a note for ${proposer}, e.g. "Weekends work better"`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <button type="button" className="pick-none" disabled={busy} onClick={() => void decline(page)}>
            Tell {proposer} none of these work
          </button>
        </>
      ) : (
        <button type="button" className="pick-none" onClick={() => setNoteOpen(true)}>
          None of these work
        </button>
      )}
    </>,
  );
};

export default LeaguePickPage;
