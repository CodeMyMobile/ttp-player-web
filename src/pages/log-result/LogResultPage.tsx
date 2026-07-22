import { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { CalendarCheck, Info } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Shell } from "./Shell";
import { MatchTypeToggle } from "./MatchTypeToggle";
import type { MatchType } from "./MatchTypeToggle";
import { PlayerPicker } from "./PlayerPicker";
import { WhenWhere } from "./WhenWhere";
import { ScoreSection } from "./Scoreboard";
import type { ScoreControls } from "./Scoreboard";
import { ReviewCard } from "./ReviewCard";
import { SentCard } from "./SentCard";
import { Avatar, PrimaryButton, SectionLabel } from "./ui";
import {
  resolveLeagueOpponent,
  submitLeagueMatchResult,
  submitMatchResult,
  useCurrentUser,
  useLeagueFixtures,
  usePlayers,
  useCourtsApi,
} from "./data";
import type { League, LeagueFixture } from "./data";
import { TODAY, newSet, computeResult, buildSubmitPayload, setStatus, setWinnerSide } from "./scoring";
import type { Player, Court, Format, MatchSet, Side } from "./scoring";

type Step = "form" | "review" | "sent";

interface LeagueFixturePickerProps {
  me: { id: string; name: string };
  leagues: League[];
  fixtures: LeagueFixture[];
  selectedLeagueId: string;
  selectedFixtureId: string;
  loading: boolean;
  error: string | null;
  onLeagueChange: (leagueId: string) => void;
  onFixtureChange: (fixtureId: string) => void;
}

function LeagueFixturePicker({
  me,
  leagues,
  fixtures,
  selectedLeagueId,
  selectedFixtureId,
  loading,
  error,
  onLeagueChange,
  onFixtureChange,
}: LeagueFixturePickerProps) {
  const selectedFixture = fixtures.find((fixture) => fixture.id === selectedFixtureId) || null;
  const opponentName = selectedFixture ? resolveLeagueOpponent(selectedFixture, me).name : null;

  return (
    <div>
      <SectionLabel icon={CalendarCheck}>League fixture</SectionLabel>
      <div className="space-y-2.5">
        <select
          value={selectedLeagueId}
          onChange={(event) => onLeagueChange(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base sm:text-sm font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
        >
          <option value="">Select league</option>
          {leagues.map((league) => (
            <option key={league.id} value={league.id}>
              {league.name} {league.skillBand ? `(${league.skillBand})` : ""}
            </option>
          ))}
        </select>

        <select
          value={selectedFixtureId}
          onChange={(event) => onFixtureChange(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base sm:text-sm font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
          disabled={!selectedLeagueId || loading}
        >
          <option value="">Select fixture</option>
          {fixtures
            .filter((fixture) => fixture.status !== "confirmed")
            .map((fixture) => (
              <option key={fixture.id} value={fixture.id}>
                #{fixture.matchNumber} {fixture.player1Name} vs {fixture.player2Name}
              </option>
            ))}
        </select>

        {loading ? <p className="text-xs text-slate-400">Loading fixtures...</p> : null}
        {error ? <p className="text-xs text-rose-500">{error}</p> : null}

        {selectedFixture && opponentName ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-violet-200 bg-violet-50 p-3">
            <Avatar name={me.name} size="h-9 w-9" />
            <span className="text-xs font-bold text-slate-400">vs</span>
            <Avatar name={opponentName} color="bg-sky-100 text-sky-700" size="h-9 w-9" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 truncate">{opponentName}</div>
              <div className="text-[11px] font-semibold text-violet-600">League match #{selectedFixture.matchNumber}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function LogResultPage() {
  const { user } = useAuth();
  const routerLocation = useLocation();
  const me = useCurrentUser(user);
  const { courts, loading: courtsLoading, error: courtsError } = useCourtsApi();

  const [step, setStep] = useState<Step>("form");
  // No default — the user must pick Casual or League on this global entry point.
  // (Logging a score from *inside* a league is a separate route — the
  // LeagueDetailPage score drawer, which pre-fills the league — out of scope here.)
  const [matchType, setMatchType] = useState<MatchType | null>(null);
  const [opponent, setOpponent] = useState<Player | null>(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const { players, loading: playersLoading, error: playersError } = usePlayers(playerSearch);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [selectedFixtureId, setSelectedFixtureId] = useState("");
  const {
    leagues,
    fixtures: leagueFixtures,
    loading: leaguesLoading,
    error: leaguesError,
  } = useLeagueFixtures(selectedLeagueId);
  const [date, setDate] = useState<string>(TODAY);
  const [court, setCourt] = useState<Court | null>(null);
  const [format, setFormat] = useState<Format>("bo3");
  // bo3 keeps a full 3-slot array; progressive reveal decides how many rows show.
  const [sets, setSets] = useState<MatchSet[]>([newSet(), newSet(), newSet()]);
  const [dnf, setDnf] = useState(false);
  const [dnfWinner, setDnfWinner] = useState<Side | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sentMatch, setSentMatch] = useState<{ id: string | number | null; status: string | null }>({
    id: null,
    status: null,
  });

  // all set/format mutations live here so the score components stay presentational
  const controls = useMemo<ScoreControls>(() => ({
    changeFormat: (f) => {
      setFormat(f);
      setSets((prev) => {
        if (f === "single") return [{ ...prev[0], kind: "set" }];
        const arr = prev.slice(0, 3).map((s) => ({ ...s }));
        while (arr.length < 3) arr.push(newSet());
        return arr;
      });
    },
    setVal: (i, side, v) => setSets((s) => s.map((row, idx) => (idx === i ? { ...row, [side]: v } : row))),
    setTb: (i, side, v) => setSets((s) => s.map((row, idx) => (idx === i ? { ...row, tb: { ...(row.tb || { you: 0, opp: 0 }), [side]: v } } : row))),
    toggleTb: (i) => setSets((s) => s.map((row, idx) => (idx === i ? { ...row, tb: row.tb ? null : { you: 0, opp: 0 } } : row))),
    setKind: (i, kind) => setSets((s) => s.map((row, idx) => (idx === i ? { kind, you: 0, opp: 0, tb: null } : row))),
    addSet: () => setSets((s) => (s.length < 3 ? [...s, newSet()] : s)),
    removeSet: (i) => setSets((s) => s.filter((_, idx) => idx !== i)),
    toggleDnf: () => { setDnf((d) => !d); setDnfWinner(null); },
    setDnfWinner: (w) => setDnfWinner(w),
  }), []);

  // Clear a stale deciding set ONLY when the match is genuinely decided in two
  // sets (both valid + same winner). NOT while an earlier set is transiently
  // invalid mid-edit (e.g. 6–6 as you change a score) — doing so would silently
  // wipe an already-entered Set 3 and make later sets vanish as you type.
  useEffect(() => {
    if (format !== "bo3") return;
    const s0 = sets[0];
    const s1 = sets[1];
    const decidedInTwo =
      !!s0 && !!s1 &&
      setStatus(s0) === "ok" && setStatus(s1) === "ok" &&
      setWinnerSide(s0) === setWinnerSide(s1);
    if (decidedInTwo && sets[2] && setStatus(sets[2]) !== "empty") {
      setSets((s) => s.map((row, i) => (i === 2 ? newSet() : row)));
    }
  }, [sets, format]);

  // Preselect from nav-state when arriving from a specific league (the league
  // page's "Add Score" or the dashboard's "Log a Score") so this page opens
  // straight into League mode with that league chosen — mirroring the flow.
  useEffect(() => {
    const preset = routerLocation.state as { matchType?: MatchType; leagueId?: string | number } | null;
    if (!preset) return;
    if (preset.matchType) setMatchType(preset.matchType);
    if (preset.leagueId != null) setSelectedLeagueId(String(preset.leagueId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedLeagueId && leagues[0]) setSelectedLeagueId(leagues[0].id);
  }, [leagues, selectedLeagueId]);

  useEffect(() => {
    setSelectedFixtureId("");
  }, [selectedLeagueId]);

  const selectedFixture = useMemo(
    () => leagueFixtures.find((fixture) => fixture.id === selectedFixtureId) || null,
    [leagueFixtures, selectedFixtureId],
  );

  const leagueOpponent = useMemo<Player | null>(() => {
    if (!selectedFixture) return null;
    const opponent = resolveLeagueOpponent(selectedFixture, me);
    return {
      id: opponent.id,
      name: opponent.name,
      ntrp: "",
      color: "bg-sky-100 text-sky-700",
    };
  }, [me.id, me.name, selectedFixture]);

  const effectiveOpponent = matchType === "league" ? leagueOpponent : matchType === "recreational" ? opponent : null;

  const result = useMemo(() => computeResult({ sets, dnf, dnfWinner, format }), [sets, dnf, dnfWinner, format]);
  const valid = !!(matchType && effectiveOpponent && court && result.complete && me.id && (matchType === "recreational" || selectedFixture));
  const missing = !matchType ? "Choose Casual or League to start."
    : matchType === "league" && leaguesLoading ? "Loading league fixtures."
    : matchType === "league" && leaguesError ? "League fixtures are unavailable right now."
    : matchType === "league" && !selectedLeagueId ? "No active league found."
    : matchType === "league" && !selectedFixture ? "Choose a league fixture to continue."
    : !effectiveOpponent ? "Choose your opponent to continue."
    : courtsLoading ? "Loading courts."
    : courtsError ? "Courts are unavailable right now."
    : !court ? "Choose a court to continue."
    : !result.complete ? "Finish entering the score."
    : "You’ll check it on the next screen before it’s sent.";

  const reset = () => {
    setStep("form"); setOpponent(null); setSelectedFixtureId(""); setDate(TODAY); setCourt(null);
    setFormat("bo3"); setSets([newSet(), newSet(), newSet()]); setDnf(false); setDnfWinner(null);
    setSubmitting(false); setSubmitError(null);
    setSentMatch({ id: null, status: null });
  };

  const submit = async () => {
    if (!effectiveOpponent || !court) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = buildSubmitPayload({ me, opponent: effectiveOpponent, date, court, format, sets, dnf, dnfWinner });
      const response = matchType === "league" && selectedLeagueId && selectedFixtureId
        ? (await submitLeagueMatchResult(selectedLeagueId, selectedFixtureId, payload)).match_result || {}
        : await submitMatchResult(payload);
      setSentMatch({
        id: response.match_id || null,
        status: response.status || "pending",
      });
      setStep("sent");
    } catch (error) {
      const apiErrors = (error as { data?: { errors?: string[] } })?.data?.errors;
      setSubmitError(
        Array.isArray(apiErrors) && apiErrors.length
          ? apiErrors.join(", ")
          : error instanceof Error
            ? error.message
            : "Could not submit result.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "review" && effectiveOpponent && court) {
    return (
      <Shell
        title="Review result"
        me={me}
        onBack={() => setStep("form")}
        footer={
          <>
            <PrimaryButton disabled={submitting} onClick={submit}>
              {submitting ? "Sending..." : `Send to ${effectiveOpponent.name}`}
            </PrimaryButton>
            {submitError && (
              <p className="mt-2 text-center text-xs font-semibold text-rose-600">{submitError}</p>
            )}
            <button onClick={() => setStep("form")} className="mt-2 w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Back to edit</button>
          </>
        }
      >
        <ReviewCard me={me} opponent={effectiveOpponent} date={date} court={court} format={format} sets={sets} dnf={dnf} result={result} />
      </Shell>
    );
  }

  if (step === "sent" && effectiveOpponent && court) {
    return (
      <Shell title="Sent" me={me} onBack={reset}>
        <SentCard
          me={me}
          opponent={effectiveOpponent}
          date={date}
          court={court}
          sets={sets}
          dnf={dnf}
          matchId={sentMatch.id}
          status={sentMatch.status}
          onLogAnother={reset}
        />
      </Shell>
    );
  }

  return (
    <Shell
      title="Log a result"
      me={me}
      footer={
        <>
          <PrimaryButton disabled={!valid} onClick={() => setStep("review")}>Review result</PrimaryButton>
          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-slate-400"><Info className="h-3.5 w-3.5 mt-px shrink-0" />{missing}</p>
        </>
      }
    >
      <div className="rounded-2xl border border-slate-200 bg-white shadow-md shadow-slate-200/60">
        <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">
          <MatchTypeToggle
            value={matchType}
            onChange={(nextType) => {
              setMatchType(nextType);
              setOpponent(null);
              setSelectedFixtureId("");
            }}
          />
          {matchType === "league" ? (
            <LeagueFixturePicker
              me={me}
              leagues={leagues}
              fixtures={leagueFixtures}
              selectedLeagueId={selectedLeagueId}
              selectedFixtureId={selectedFixtureId}
              loading={leaguesLoading}
              error={leaguesError}
              onLeagueChange={setSelectedLeagueId}
              onFixtureChange={setSelectedFixtureId}
            />
          ) : matchType === "recreational" ? (
            <PlayerPicker
              me={me}
              players={players}
              playersLoading={playersLoading}
              playersError={playersError}
              searchQuery={playerSearch}
              onSearchChange={setPlayerSearch}
              value={opponent}
              onChange={setOpponent}
            />
          ) : null}
          <WhenWhere date={date} onDateChange={setDate} court={court} onCourtChange={setCourt} courts={courts} />
          <ScoreSection me={me} opponent={opponent} format={format} sets={sets} dnf={dnf} dnfWinner={dnfWinner} result={result} controls={controls} />
        </div>
      </div>
    </Shell>
  );
}
