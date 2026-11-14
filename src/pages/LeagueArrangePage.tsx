import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Plus } from "lucide-react";

import MainLayout from "../components/MainLayout";
import { getAvailabilityOverlap, viewerTimeZone } from "../api/availability";
import {
  getLeagueFixtures,
  getLeaguePlayerCourts,
  getMyPlayedCourts,
  proposeFixtureTimes,
  type LeagueFixture,
} from "../api/leagues";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";
import { ANALYTICS_EVENTS, track } from "../utils/analytics";
import {
  MAX_PROPOSED_TIMES,
  choicesFromWindows,
  courtChips,
  fixtureAgainst,
  formatProposedTime,
  initialSelection,
  localInputToIso,
  timesToSend,
  windowLabel,
  type CourtChip,
  type TimeChoice,
} from "../utils/leagueArrange";
import { useCourtsApi } from "./log-result/data";

import "./LeagueArrangePage.css";

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; fixture: LeagueFixture | null; leagueName: string; opponentName: string; bothFree: boolean };

/**
 * Propose times for a league fixture (home v2, §6.2): "You're both free" times from both players'
 * weekly availability (top three ticked), any time added by hand, a court, and Send. The opponent
 * gets a text and picks one (ttp-api #458/#461).
 */
const LeagueArrangePage = () => {
  const { id: leagueId = "", opponentId = "" } = useParams();
  const { user } = useAuth();
  const token = useMemo(
    () =>
      user?.session?.access_token ??
      user?.access_token ??
      user?.token ??
      getStoredAuthToken({ preferScheme: "token" }) ??
      undefined,
    [user],
  );
  const { courts, loading: courtsLoading } = useCourtsApi();
  const timeZone = viewerTimeZone();

  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [choices, setChoices] = useState<TimeChoice[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState("");
  const [courtId, setCourtId] = useState("");
  const [chips, setChips] = useState<CourtChip[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ texted: boolean } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    Promise.all([
      getLeagueFixtures({ leagueId, token, mine: true, signal: controller.signal }),
      getAvailabilityOverlap({ playerId: opponentId, token, signal: controller.signal }).catch(() => null),
      // Where each of you plays, for the court chips; either failing just means fewer chips.
      getMyPlayedCourts({ token, signal: controller.signal }).catch(() => ({ courts: [] })),
      getLeaguePlayerCourts({ leagueId, playerId: opponentId, token, signal: controller.signal }).catch(() => ({ courts: [] })),
    ])
      .then(([fixturesRes, overlap, mineRes, theirsRes]) => {
        if (controller.signal.aborted) return;
        const fixture = fixtureAgainst(fixturesRes.fixtures ?? [], opponentId);
        const opponentName = fixture
          ? String(fixture.player1_id) === String(opponentId)
            ? fixture.player1_name
            : fixture.player2_name
          : null;
        const suggestions = choicesFromWindows(overlap?.windows ?? []);
        setChips(courtChips(mineRes.courts ?? [], theirsRes.courts ?? [], String(opponentName || "Your opponent").split(" ")[0]));
        setChoices(suggestions);
        setSelected(initialSelection(suggestions));
        if (fixture) track(ANALYTICS_EVENTS.leagueArrangeStart);
        setLoad({
          status: "ready",
          fixture,
          leagueName: fixturesRes.league?.name ?? "League",
          opponentName: opponentName || "your opponent",
          bothFree: Boolean(overlap?.has_availability.you && overlap?.has_availability.them),
        });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setLoad({ status: "error", message: error instanceof Error ? error.message : "Couldn't load this match." });
        }
      });
    return () => controller.abort();
  }, [leagueId, opponentId, token]);

  const times = timesToSend(choices, selected);
  const chosenChip = chips.find((chip) => chip.id === courtId) ?? null;
  const court = chosenChip ?? courts.find((item) => String(item.id) === courtId) ?? null;
  const full = selected.size >= MAX_PROPOSED_TIMES;

  const addCustom = () => {
    const iso = localInputToIso(custom);
    if (!iso || Date.parse(iso) <= Date.now()) return;
    setChoices((current) => (current.some((choice) => choice.key === iso) ? current : [...current, { key: iso, start: iso }]));
    if (!full) setSelected((current) => new Set(current).add(iso));
    setCustom("");
  };

  const send = async () => {
    if (load.status !== "ready" || !load.fixture || !court || !times.length) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await proposeFixtureTimes({
        leagueId,
        fixtureId: load.fixture.id,
        token,
        body: {
          times,
          location: { location_text: court.name, latitude: court.latitude ?? null, longitude: court.longitude ?? null },
          timezone: timeZone,
        },
      });
      track(ANALYTICS_EVENTS.leagueTimesSent, { count: times.length });
      setSent({ texted: Boolean(res.texted) });
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Couldn't send the times.");
    } finally {
      setSending(false);
    }
  };

  const back = `/leagues/${leagueId}/dashboard`;

  if (load.status === "loading") {
    return (
      <MainLayout>
        <div className="arrange-page">
          <div className="arrange-skeleton" aria-busy="true" />
        </div>
      </MainLayout>
    );
  }

  if (load.status === "error" || !load.fixture) {
    return (
      <MainLayout>
        <div className="arrange-page">
          <h1 className="arrange-page__title">Arrange a match</h1>
          <p className="arrange-page__lede">
            {load.status === "error"
              ? load.message
              : `You don't have a match left to arrange against ${load.opponentName} in this league.`}
          </p>
          <Link className="arrange-page__link" to={back}>Back to the league</Link>
        </div>
      </MainLayout>
    );
  }

  const { opponentName, leagueName, fixture, bothFree } = load;
  const first = opponentName.split(" ")[0];

  if (sent) {
    return (
      <MainLayout>
        <div className="arrange-page">
          <h1 className="arrange-page__title">Sent to {first}</h1>
          <p className="arrange-page__lede">
            {sent.texted
              ? `${first} gets a text with a link to pick one. We'll text you when they do.`
              : `${first} has no number on file, so they'll see your times on the league page.`}
          </p>
          <Link className="arrange-page__link" to={back}>Back to the league</Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="arrange-page">
        <h1 className="arrange-page__title">You vs {opponentName}</h1>
        <p className="arrange-page__lede">{leagueName}</p>

        {fixture.scheduled_match?.picked ? (
          <p className="arrange-page__warn">
            You're already booked for {formatProposedTime(fixture.scheduled_match.start_date_time, timeZone)}. Sending new
            times replaces that booking.
          </p>
        ) : null}

        <section className="arrange-block" aria-labelledby="arrange-free">
          <h2 className="arrange-h" id="arrange-free">You're both free</h2>
          {choices.length === 0 ? (
            <p className="arrange-empty">
              {bothFree
                ? "No shared times this week. Add a time below."
                : `We can't suggest times until you and ${first} have both set when you can play. Add a time below.`}
            </p>
          ) : null}
          <ul className="arrange-list">
            {choices.map((choice) => {
              const on = selected.has(choice.key);
              return (
                <li key={choice.key}>
                  <label className={`arrange-row${on ? " is-on" : ""}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!on && full}
                      onChange={() =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (next.has(choice.key)) next.delete(choice.key);
                          else next.add(choice.key);
                          return next;
                        })
                      }
                    />
                    <span className="arrange-row__box" aria-hidden="true">{on ? <Check size={16} /> : null}</span>
                    <span className="arrange-row__text">
                      <span className="arrange-row__when">{formatProposedTime(choice.start, timeZone)}</span>
                      <span className="arrange-row__window">
                        {choice.window ? windowLabel(choice.window, timeZone) : "Added by you"}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="arrange-add">
            <label className="sr-only" htmlFor="arrange-custom">Another time</label>
            <input
              id="arrange-custom"
              type="datetime-local"
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
            />
            <button type="button" onClick={addCustom} disabled={!localInputToIso(custom)}>
              <Plus size={16} aria-hidden="true" /> Add another time
            </button>
          </div>
          {full ? <p className="arrange-note">Up to {MAX_PROPOSED_TIMES} times.</p> : null}
        </section>

        <section className="arrange-block" aria-labelledby="arrange-where">
          <h2 className="arrange-h" id="arrange-where">Where</h2>
          {chips.length ? (
            <div className="arrange-chips" role="group" aria-label="Courts you play at">
              {chips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={courtId === chip.id}
                  className={`arrange-chip${courtId === chip.id ? " is-on" : ""}`}
                  onClick={() => setCourtId(chip.id)}
                >
                  <span className="arrange-chip__name">{chip.name}</span>
                  <span className="arrange-chip__note">{chip.note}</span>
                </button>
              ))}
            </div>
          ) : null}
          <label className="sr-only" htmlFor="arrange-court">{chips.length ? "Another court" : "Court"}</label>
          <select
            id="arrange-court"
            className="arrange-select"
            value={chosenChip ? "" : courtId}
            onChange={(event) => setCourtId(event.target.value)}
            disabled={courtsLoading}
          >
            <option value="">{courtsLoading ? "Loading courts..." : chips.length ? "Another court" : "Choose a court"}</option>
            {courts.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.area ? `${item.name} · ${item.area}` : item.name}
              </option>
            ))}
          </select>
        </section>

        <div className="arrange-foot">
          <button type="button" className="arrange-send" disabled={!times.length || !court || sending} onClick={() => void send()}>
            {sending
              ? "Sending..."
              : times.length
                ? `Send ${times.length} ${times.length === 1 ? "time" : "times"} to ${first}`
                : `Send times to ${first}`}
          </button>
          <p className="arrange-note">
            {sendError ?? (!court ? "Choose a court to send." : `${first} gets a text with a link to pick one.`)}
          </p>
        </div>
      </div>
    </MainLayout>
  );
};

export default LeagueArrangePage;
