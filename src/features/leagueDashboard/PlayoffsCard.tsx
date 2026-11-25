// The league's playoff bracket (ttp-api #475), once an admin has started it: where the viewer
// stands, with Arrange and Log score for their match, then every round. Players arrange,
// score and confirm a playoff match exactly as they do in the season; the winner moves on
// when the score is confirmed.

import { Link } from "react-router-dom";

import type { PlayoffBracket } from "../../api/leagues";
import { championName, playoffShortLabel, playoffSide, type PlayoffSide, type ViewerPlayoffState } from "../../utils/leaguePlayoffs";

interface PlayoffsCardProps {
  leagueId: string;
  bracket: PlayoffBracket;
  viewer: ViewerPlayoffState;
  viewerId?: string | null;
}

const seeded = (side: PlayoffSide) => (side.seed ? `(${side.seed}) ${side.name}` : side.name);

const ViewerLine = ({ leagueId, viewer }: { leagueId: string; viewer: ViewerPlayoffState }) => {
  switch (viewer.kind) {
    case "play":
      return (
        <div className="lgd-playoffs__mine is-live">
          <div className="lgd-playoffs__mine-text">
            <strong>Your {viewer.round.toLowerCase()} against {seeded(viewer.opponent)}</strong>
            <span>No deadline. Arrange a time, then log the score; the winner goes through.</span>
          </div>
          <div className="lgd-playoffs__mine-actions">
            {viewer.opponent.playerId ? (
              <Link className="btn ghost" to={`/leagues/${leagueId}/arrange/${viewer.opponent.playerId}`}>
                Arrange
              </Link>
            ) : null}
            <Link className="btn" to={`/log-result?league=${leagueId}&fixture=${viewer.match.id}`}>
              Log score
            </Link>
          </div>
        </div>
      );
    case "score-sent":
      return (
        <div className="lgd-playoffs__mine">
          <div className="lgd-playoffs__mine-text">
            <strong>Your {viewer.round.toLowerCase()} against {viewer.opponent.name}</strong>
            <span>The score is waiting to be confirmed. Once it is, the winner goes through.</span>
          </div>
        </div>
      );
    case "waiting":
      return (
        <div className="lgd-playoffs__mine">
          <div className="lgd-playoffs__mine-text">
            <strong>You're through to the {viewer.round.toLowerCase()}</strong>
            <span>You'll play the {viewer.waitingFor.charAt(0).toLowerCase()}{viewer.waitingFor.slice(1)}. We'll text you when they're decided.</span>
          </div>
        </div>
      );
    case "out":
      return (
        <div className="lgd-playoffs__mine is-quiet">
          <div className="lgd-playoffs__mine-text">
            <span>You went out in the {viewer.round.toLowerCase()}.</span>
          </div>
        </div>
      );
    case "champion":
      return (
        <div className="lgd-playoffs__mine is-live">
          <div className="lgd-playoffs__mine-text">
            <strong>You won the playoffs. You're the league champion!</strong>
          </div>
        </div>
      );
    default:
      return null;
  }
};

const PlayoffsCard = ({ leagueId, bracket, viewer, viewerId }: PlayoffsCardProps) => {
  const champion = championName(bracket);

  return (
    <section className="card lgd-playoffs" aria-labelledby="lgd-playoffs-h">
      <div className="lgd-playoffs__head">
        <h2 id="lgd-playoffs-h">Playoffs</h2>
        {champion ? <span className="lgd-playoffs__champion">Champion: {champion}</span> : null}
      </div>

      <ViewerLine leagueId={leagueId} viewer={viewer} />

      <div className="lgd-bracket" role="list" aria-label="Playoff bracket">
        {bracket.rounds.map((round) => (
          <div className="lgd-bracket__round" key={round.round} role="listitem">
            <h3>{round.name}</h3>
            <div className="lgd-bracket__matches">
              {round.matches.map((match) => (
                <div className="lgd-bracket__match" key={match.id}>
                  <span className="lgd-bracket__label">{playoffShortLabel(match)}</span>
                  {([1, 2] as const).map((sideNo) => {
                    const side = playoffSide(match, sideNo);
                    const isMe = Boolean(viewerId && side.playerId === String(viewerId));
                    const classes = [
                      "lgd-bracket__side",
                      side.won ? "is-won" : "",
                      side.placeholder ? "is-empty" : "",
                      isMe ? "is-me" : "",
                    ].filter(Boolean).join(" ");
                    return (
                      <div className={classes} key={sideNo}>
                        {side.seed ? <span className="lgd-bracket__seed">{side.seed}</span> : null}
                        <span className="lgd-bracket__name">{side.name}</span>
                      </div>
                    );
                  })}
                  {match.score ? <span className="lgd-bracket__score">{match.score}</span> : null}
                  {match.status === "walkover" ? <span className="lgd-bracket__score">Walkover</span> : null}
                  {match.status === "pending_confirmation" ? <span className="lgd-bracket__score">Score waiting to be confirmed</span> : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default PlayoffsCard;
