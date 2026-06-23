import { useState, useMemo } from "react";
import { Info } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Shell } from "./Shell";
import { MatchTypeToggle } from "./MatchTypeToggle";
import { PlayerPicker } from "./PlayerPicker";
import { WhenWhere } from "./WhenWhere";
import { ScoreSection } from "./Scoreboard";
import type { ScoreControls } from "./Scoreboard";
import { ReviewCard } from "./ReviewCard";
import { SentCard } from "./SentCard";
import { PrimaryButton } from "./ui";
import { submitMatchResult, useCurrentUser, usePlayers, useCourtsApi } from "./data";
import { TODAY, newSet, computeResult, buildSubmitPayload } from "./scoring";
import type { Player, Court, Format, MatchSet, Side } from "./scoring";

type Step = "form" | "review" | "sent";

export default function LogResultPage() {
  const { user } = useAuth();
  const me = useCurrentUser(user);
  const { courts, loading: courtsLoading, error: courtsError } = useCourtsApi();

  const [step, setStep] = useState<Step>("form");
  const [opponent, setOpponent] = useState<Player | null>(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const { players, loading: playersLoading, error: playersError } = usePlayers(playerSearch);
  const [date, setDate] = useState<string>(TODAY);
  const [court, setCourt] = useState<Court | null>(null);
  const [format, setFormat] = useState<Format>("bo3");
  const [sets, setSets] = useState<MatchSet[]>([newSet(), newSet()]);
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
        while (arr.length < 2) arr.push(newSet());
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

  const result = useMemo(() => computeResult({ sets, dnf, dnfWinner, format }), [sets, dnf, dnfWinner, format]);
  const valid = !!(opponent && court && result.complete && me.id);
  const missing = !opponent ? "Choose your opponent to continue."
    : courtsLoading ? "Loading courts."
    : courtsError ? "Courts are unavailable right now."
    : !court ? "Choose a court to continue."
    : !result.complete ? "Finish entering the score."
    : "You’ll check it on the next screen before it’s sent.";

  const reset = () => {
    setStep("form"); setOpponent(null); setDate(TODAY); setCourt(null);
    setFormat("bo3"); setSets([newSet(), newSet()]); setDnf(false); setDnfWinner(null);
    setSubmitting(false); setSubmitError(null);
    setSentMatch({ id: null, status: null });
  };

  const submit = async () => {
    if (!opponent || !court) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = buildSubmitPayload({ me, opponent, date, court, format, sets, dnf, dnfWinner });
      const response = await submitMatchResult(payload);
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

  if (step === "review" && opponent && court) {
    return (
      <Shell
        title="Review result"
        me={me}
        onBack={() => setStep("form")}
        footer={
          <>
            <PrimaryButton disabled={submitting} onClick={submit}>
              {submitting ? "Sending..." : `Send to ${opponent.name}`}
            </PrimaryButton>
            {submitError && (
              <p className="mt-2 text-center text-xs font-semibold text-rose-600">{submitError}</p>
            )}
            <button onClick={() => setStep("form")} className="mt-2 w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Back to edit</button>
          </>
        }
      >
        <ReviewCard me={me} opponent={opponent} date={date} court={court} format={format} sets={sets} dnf={dnf} result={result} />
      </Shell>
    );
  }

  if (step === "sent" && opponent && court) {
    return (
      <Shell title="Sent" me={me} onBack={reset}>
        <SentCard
          me={me}
          opponent={opponent}
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
      <div className="rounded-2xl border border-slate-200 bg-white shadow-md shadow-slate-200/60 overflow-hidden">
        <div className="px-4 sm:px-6 pt-4 pb-3.5 border-b border-slate-100">
          <p className="text-sm text-slate-500">Enter the score, then send it to your opponent to confirm.</p>
        </div>
        <div className="px-4 sm:px-6 py-5 sm:py-6 space-y-6">
          <MatchTypeToggle />
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
          <WhenWhere date={date} onDateChange={setDate} court={court} onCourtChange={setCourt} courts={courts} />
          <ScoreSection me={me} opponent={opponent} format={format} sets={sets} dnf={dnf} dnfWinner={dnfWinner} result={result} controls={controls} />
        </div>
      </div>
    </Shell>
  );
}
