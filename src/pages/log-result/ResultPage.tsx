import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import MainLayout from "../../components/MainLayout";
import { getLeagueStandings, type LeagueStanding } from "../../api/leagues";
import { useAuth } from "../../context/AuthContext";
import { useBestBets } from "../../features/leagueDashboard/useBestBets";
import { getStoredAuthToken } from "../../services/authToken";
import { ANALYTICS_EVENTS, track } from "../../utils/analytics";
import { bestBetLine, bestBetsWithTimes } from "../../utils/availabilityGrid";
import { getMatchOutcome, useCurrentUser, type MatchOutcome } from "./data";
import { deltaChip, formatRating, headline, placesChip, resultLine } from "./outcome";
import { drawStandingsImage, shareStandingsImage, standingsImageRows } from "./standingsImage";

import "./ResultPage.css";

type Load = { status: "loading" } | { status: "error" } | { status: "ready"; outcome: MatchOutcome };

/**
 * The result (home v2, §6.6): W/L and the score, the rating before and after, for a league match
 * the places moved and the rows around you, a standings picture to share with the league's group,
 * and who to play next. Numbers come from ttp-api GET /match-results/:id/outcome.
 */
const ResultPage = () => {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const me = useCurrentUser(user);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [standings, setStandings] = useState<{ leagueName: string; rows: LeagueStanding[] } | null>(null);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getMatchOutcome(id)
      .then((res) => alive && setLoad({ status: "ready", outcome: res.outcome }))
      .catch(() => alive && setLoad({ status: "error" }));
    return () => {
      alive = false;
    };
  }, [id]);

  const outcome = load.status === "ready" ? load.outcome : null;
  const leagueId = outcome?.status === "confirmed" ? outcome.league?.id ?? null : null;

  useEffect(() => {
    if (!leagueId) return undefined;
    const controller = new AbortController();
    getLeagueStandings({ leagueId, token: getStoredAuthToken() ?? undefined, signal: controller.signal })
      .then((res) => setStandings({ leagueName: res.league?.name || "League", rows: res.standings ?? [] }))
      .catch(() => setStandings(null));
    return () => controller.abort();
  }, [leagueId]);

  const imageRows = useMemo(() => (standings ? standingsImageRows(standings.rows, me.id || null) : []), [standings, me.id]);

  useEffect(() => {
    if (!standings || !imageRows.length) return undefined;
    let url: string | null = null;
    let alive = true;
    drawStandingsImage({
      leagueName: standings.leagueName,
      rows: imageRows,
      subtitle: `Standings · ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    })
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setImage({ blob, url });
      })
      .catch(() => setImage(null));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [standings, imageRows]);

  const bestBets = useBestBets(leagueId, Boolean(leagueId));
  const next =
    bestBets.status === "ready"
      ? bestBetsWithTimes(bestBets.data.opponents).find((bet) => String(bet.player_id) !== String(outcome?.opponent.id))
      : undefined;

  const canShareFiles = typeof navigator !== "undefined" && typeof (navigator as Navigator & { canShare?: unknown }).canShare === "function";

  const share = async () => {
    if (!image || !standings) return;
    const result = await shareStandingsImage(image.blob, standings.leagueName);
    if (result !== "cancelled") track(ANALYTICS_EVENTS.leagueStandingsShared, { method: result });
    setShareNote(result === "downloaded" ? "Saved the picture. Post it in your league's group." : null);
  };

  if (load.status !== "ready" || !outcome) {
    return (
      <MainLayout>
        <div className="result-page">
          {load.status === "loading" ? (
            <div className="result-skeleton" aria-busy="true" />
          ) : (
            <>
              <h1 className="result-title">Couldn't load this result</h1>
              <Link className="result-link" to="/play">Back to Play</Link>
            </>
          )}
        </div>
      </MainLayout>
    );
  }

  const confirmed = outcome.status === "confirmed";
  const opponentFirst = String(outcome.opponent.name || "your opponent").split(" ")[0];
  const rating = outcome.rating;
  const delta = deltaChip(rating?.delta);
  const places = placesChip(outcome.league?.places);

  return (
    <MainLayout>
      <div className="result-page">
        <section className="result-card">
          <p className={`result-eyebrow${confirmed ? "" : " is-waiting"}`}>
            {confirmed ? "Final" : `Waiting for ${opponentFirst} to confirm`}
          </p>
          <h1 className="result-title">{resultLine(outcome)}</h1>
          {confirmed ? <p className="result-sub">{headline(outcome, me.name)}</p> : null}
        </section>

        <section className="result-card" aria-label="Your rating">
          <h2 className="result-h">Your rating</h2>
          {confirmed && rating ? (
            <>
              <p className="result-rating">
                <span>{formatRating(rating.before)}</span>
                <span aria-hidden="true">→</span>
                <strong>{formatRating(rating.after)}</strong>
                {delta ? (
                  <span className={`result-chip${(rating.delta ?? 0) > 0 ? " is-up" : ""}`}>{delta}</span>
                ) : null}
              </p>
              {outcome.first_confirmed_result ? (
                <p className="result-good">Your rating now comes from your results.</p>
              ) : null}
            </>
          ) : (
            <p className="result-sub">It updates once the score is confirmed.</p>
          )}
        </section>

        {confirmed && outcome.league ? (
          <section className="result-card" aria-label="Standings">
            <div className="result-row-head">
              <h2 className="result-h">Standings</h2>
              {places ? <span className={`result-chip${(outcome.league.places ?? 0) > 0 ? " is-up" : ""}`}>{places}</span> : null}
            </div>
            <ol className="result-standings">
              {outcome.league.rows_around.map((row) => (
                <li key={row.player_id} className={row.you ? "is-you" : undefined}>
                  <span className="result-standings__rank">{row.rank}</span>
                  <span className="result-standings__name">{row.you ? "You" : row.name || "Player"}</span>
                  <span className="result-standings__rec">{row.wins}–{row.losses}</span>
                </li>
              ))}
            </ol>
            <Link className="result-link" to={`/leagues/${outcome.league.id}/dashboard`}>
              Full standings
            </Link>
          </section>
        ) : null}

        {image ? (
          <section className="result-card" aria-label="Share the standings">
            <h2 className="result-h">Share with your league</h2>
            <img className="result-image" src={image.url} alt={`${standings?.leagueName ?? "League"} standings`} />
            <button type="button" className="result-share" onClick={() => void share()}>
              {canShareFiles ? "Share to WhatsApp" : "Download picture"}
            </button>
            {shareNote ? <p className="result-sub" role="status">{shareNote}</p> : null}
          </section>
        ) : null}

        {next && outcome.league ? (
          <section className="result-card result-next" aria-label="Who to play next">
            <div>
              <h2 className="result-h">Next: {next.name || "League player"}</h2>
              <p className="result-good">{bestBetLine(next)}</p>
            </div>
            <Link className="result-arrange" to={`/leagues/${outcome.league.id}/arrange/${next.player_id}`}>
              Arrange
            </Link>
          </section>
        ) : null}
      </div>
    </MainLayout>
  );
};

export default ResultPage;
