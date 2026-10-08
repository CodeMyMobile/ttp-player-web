import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import MatchDetailsModal from "../components/MatchDetailsModal.jsx";

// Dev-only stand-in for the match waitlist backend, which does not exist yet.
// It answers the endpoints in docs/match-waitlist-backend-brief.md from memory,
// so the modal runs its real service calls. Nothing here ships to players.

const MATCH_ID = "preview-waitlist";
const HOST_ID = "host-1";
const VIEWER_ID = "player-42";

const PEOPLE = {
  [HOST_ID]: { full_name: "Avery Morgan", usta_rating: "4.0" },
  "player-2": { full_name: "Sam Whitfield", usta_rating: "3.5" },
  "player-3": { full_name: "Priya Nair", usta_rating: "4.0" },
  "player-4": { full_name: "Marcus Bell", usta_rating: "3.5" },
  [VIEWER_ID]: { full_name: "Jordan Lee", usta_rating: "3.5" },
  "player-7": { full_name: "Dana Okafor", usta_rating: "3.5" },
  "player-8": { full_name: "Theo Lindqvist", usta_rating: "4.0" },
};

const FULL_ROSTER = [HOST_ID, "player-2", "player-3", "player-4"];
const SHORT_ROSTER = [HOST_ID, "player-2", "player-3"];

const SCENARIOS = {
  player: { label: "Player, match full", viewer: VIEWER_ID, roster: FULL_ROSTER, waitlist: ["player-7", "player-8"] },
  waitlisted: { label: "Player, waiting", viewer: VIEWER_ID, roster: FULL_ROSTER, waitlist: ["player-7", VIEWER_ID, "player-8"] },
  choosing: { label: "Waiting, spot open", viewer: VIEWER_ID, roster: SHORT_ROSTER, waitlist: ["player-7", VIEWER_ID] },
  claim: { label: "Waiting, can claim", viewer: VIEWER_ID, roster: SHORT_ROSTER, waitlist: ["player-7", VIEWER_ID], open: true },
  held: { label: "Player, spot held", viewer: VIEWER_ID, roster: SHORT_ROSTER, waitlist: ["player-7"] },
  host: { label: "Host, match full", viewer: HOST_ID, roster: FULL_ROSTER, waitlist: ["player-7", VIEWER_ID, "player-8"] },
  "host-open": { label: "Host, spot open", viewer: HOST_ID, roster: SHORT_ROSTER, waitlist: ["player-7", VIEWER_ID, "player-8"] },
  guest: { label: "Logged out", viewer: null, roster: FULL_ROSTER, waitlist: ["player-7", "player-8"] },
  private: { label: "Private invitee", viewer: VIEWER_ID, roster: FULL_ROSTER, waitlist: ["player-7"], isPrivate: true },
  legacy: { label: "Backend without waitlist", viewer: VIEWER_ID, roster: FULL_ROSTER, waitlist: [], unsupported: true },
};

const LIMIT = 4;
const JOINED_AT = "2026-10-08T17:02:11.000Z";

const buildMatchData = (state, scenario) => {
  const viewer = scenario.viewer;
  const open = Math.max(LIMIT - state.roster.length, 0);
  const waitlistFields = scenario.unsupported
    ? {}
    : {
        waitlist_count: state.waitlist.length,
        waitlist_position: viewer && state.waitlist.includes(viewer) ? state.waitlist.indexOf(viewer) + 1 : null,
        waitlist_hold: open > 0 && state.waitlist.length > 0,
        waitlist_open: state.open && open > 0,
        ...(viewer === HOST_ID
          ? {
              waitlist: state.waitlist.map((playerId) => ({
                player_id: playerId,
                created_at: JOINED_AT,
                profile: PEOPLE[playerId],
              })),
            }
          : {}),
      };
  return {
    match: {
      id: MATCH_ID,
      host_id: HOST_ID,
      host_name: PEOPLE[HOST_ID].full_name,
      start_date_time: "2026-11-14T18:00:00.000Z",
      location_text: "Penmar Recreation Center",
      match_format: "Doubles",
      skill_level_min: "3.5",
      skill_level_max: "4.0",
      player_limit: LIMIT,
      status: "upcoming",
      match_type: scenario.isPrivate ? "private" : "open",
      capacity: { limit: LIMIT, confirmed: state.roster.length, open, isFull: open === 0 },
      ...waitlistFields,
    },
    participants: state.roster.map((playerId) => ({
      id: `participant-${playerId}`,
      player_id: playerId,
      status: playerId === HOST_ID ? "hosting" : "confirmed",
      profile: PEOPLE[playerId],
    })),
    invitees: [],
    ...(scenario.isPrivate ? { viewerInvite: { token: "preview-invite", status: "pending" } } : {}),
  };
};

// The server half: returns [status, body] and mutates `state`.
const handleRequest = (state, viewer, method, path) => {
  const free = () => state.roster.length < LIMIT;
  const closeIfFull = () => {
    if (!free()) state.open = false;
  };
  const counts = () => ({
    waitlist_count: state.waitlist.length,
    waitlist_position: state.waitlist.includes(viewer) ? state.waitlist.indexOf(viewer) + 1 : null,
  });
  const entry = path.match(/^\/waitlist\/([^/]+)(\/promote)?$/);

  if (path === "/waitlist" && method === "POST") {
    if (state.roster.includes(viewer)) return [409, { error: "already_joined" }];
    if (state.waitlist.includes(viewer)) return [409, { error: "already_waitlisted" }];
    if (free() && state.waitlist.length === 0) return [409, { error: "match_not_full" }];
    state.waitlist.push(viewer);
    return [200, counts()];
  }
  if (path === "/waitlist" && method === "DELETE") {
    state.waitlist = state.waitlist.filter((id) => id !== viewer);
    return [200, {}];
  }
  if (path === "/join" && method === "POST") {
    if (!free()) return [409, { error: "match_full" }];
    if (state.waitlist.length > 0 && !state.waitlist.includes(viewer)) return [409, { error: "waitlist_hold" }];
    if (state.waitlist.includes(viewer) && !state.open) return [409, { error: "waitlist_not_open" }];
    state.waitlist = state.waitlist.filter((id) => id !== viewer);
    state.roster.push(viewer);
    closeIfFull();
    return [200, { message: "Successfully joined the match!" }];
  }
  if (path === "/waitlist/open" && method === "POST") {
    if (!free()) return [409, { error: "match_full" }];
    if (state.waitlist.length === 0) return [409, { error: "waitlist_empty" }];
    state.open = true;
    return [200, {}];
  }
  if (entry && entry[2] && method === "POST") {
    if (!state.waitlist.includes(entry[1])) return [404, { error: "waitlist_entry_not_found" }];
    if (!free()) return [409, { error: "match_full" }];
    state.waitlist = state.waitlist.filter((id) => id !== entry[1]);
    state.roster.push(entry[1]);
    closeIfFull();
    return [200, {}];
  }
  if (entry && !entry[2] && method === "DELETE") {
    state.waitlist = state.waitlist.filter((id) => id !== entry[1]);
    return [200, {}];
  }
  if (path === "/share-link") return [200, { shareUrl: "https://example.test/m/preview-waitlist" }];
  if (path === "/notifications") return [200, { notifications: [] }];
  return [404, { error: "not_mocked" }];
};

const MatchWaitlistPreview = () => {
  const location = useLocation();
  const scenarioKey = new URLSearchParams(location.search).get("as") || "player";
  const scenario = SCENARIOS[scenarioKey] || SCENARIOS.player;

  const stateRef = useRef(null);
  const [matchData, setMatchData] = useState(null);
  const [toast, setToast] = useState(null);

  const publish = useCallback(() => {
    const next = buildMatchData(stateRef.current, scenario);
    setMatchData(next);
    return next;
  }, [scenario]);

  useEffect(() => {
    stateRef.current = {
      roster: [...scenario.roster],
      waitlist: [...scenario.waitlist],
      open: Boolean(scenario.open),
    };
    setToast(null);
    publish();
  }, [publish, scenario]);

  useEffect(() => {
    const originalFetch = window.fetch;
    const marker = `/matches/${MATCH_ID}`;
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
      const at = url.indexOf(marker);
      if (at === -1) return originalFetch(input, init);
      const path = url.slice(at + marker.length).split("?")[0];
      const method = (init?.method || "GET").toUpperCase();
      const [status, body] = handleRequest(stateRef.current, scenario.viewer, method, path);
      return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [scenario]);

  const freeASpot = () => {
    const state = stateRef.current;
    const leaving = state.roster.filter((id) => id !== HOST_ID && id !== scenario.viewer).pop();
    if (!leaving) return;
    state.roster = state.roster.filter((id) => id !== leaving);
    publish();
  };

  const currentUser = useMemo(
    () =>
      scenario.viewer
        ? { id: scenario.viewer, full_name: PEOPLE[scenario.viewer].full_name }
        : { id: null, type: 2 },
    [scenario],
  );

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [],
  );

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center gap-2 text-xs font-semibold">
        {Object.entries(SCENARIOS).map(([key, value]) => (
          <Link
            key={key}
            to={`/__preview/match-waitlist?as=${key}`}
            className={`rounded-full px-3 py-1 ${
              key === scenarioKey ? "bg-violet-500 text-white" : "bg-white text-slate-600"
            }`}
          >
            {value.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={freeASpot}
          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-700"
        >
          Simulate: a player leaves
        </button>
      </div>
      {toast && (
        <p data-testid="preview-toast" className="mx-auto mb-3 max-w-3xl rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          {toast}
        </p>
      )}
      {matchData && (
        <MatchDetailsModal
          key={scenarioKey}
          isOpen
          matchData={matchData}
          currentUser={currentUser}
          onClose={() => {}}
          onToast={(message) => setToast(message)}
          onRequireSignIn={() => setToast("(would redirect to sign in)")}
          onReloadMatch={async () => buildMatchData(stateRef.current, scenario)}
          onUpdateMatch={setMatchData}
          formatDateTime={(date) => dateFormatter.format(date)}
        />
      )}
    </div>
  );
};

export default MatchWaitlistPreview;
