import { useState, useMemo } from "react";
import { Info } from "lucide-react";
import { Shell } from "./Shell";
import { MatchTypeToggle } from "./MatchTypeToggle";
import { PlayerPicker } from "./PlayerPicker";
import { WhenWhere } from "./WhenWhere";
import { ScoreSection } from "./Scoreboard";
import { ReviewCard } from "./ReviewCard";
import { SentCard } from "./SentCard";
import { PrimaryButton } from "./ui";
import { useCurrentUser, usePlayers, useCourts } from "./data";
import { TODAY, newSet, computeResult, buildSubmitPayload } from "./scoring";

export default function LogResultPage() {
  const me = useCurrentUser();
  const players = usePlayers();
  const courts = useCourts();

  const [step, setStep] = useState("form"); // form | review | sent
  const [opponent, setOpponent] = useState(null);
  const [date, setDate] = useState(TODAY);
  const [court, setCourt] = useState(null);
  const [format, setFormat] = useState("bo3");
  const [sets, setSets] = useState([newSet(), newSet()]);
  const [dnf, setDnf] = useState(false);
  const [dnfWinner, setDnfWinner] = useState(null);

  // all set/format mutations live here so the score components stay presentational
  const controls = useMemo(() => ({
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
  const valid = !!(opponent && court && result.complete);
  const missing = !opponent ? "Choose your opponent to continue."
    : !court ? "Choose a court to continue."
    : !result.complete ? "Finish entering the score."
    : "You’ll check it on the next screen before it’s sent.";

  const reset = () => {
    setStep("form"); setOpponent(null); setDate(TODAY); setCourt(null);
    setFormat("bo3"); setSets([newSet(), newSet()]); setDnf(false); setDnfWinner(null);
  };

  const submit = () => {
    // No API yet — log the payload Sahil's endpoint will receive, then show "sent".
    // TODO(Sahil): POST /matches with this body → { match_id, status, confirm_window_ends_at }
    const payload = buildSubmitPayload({ me, opponent, date, court, format, sets, dnf, dnfWinner });
    console.log("[LogResult] would POST /matches:", payload);
    setStep("sent");
  };

  if (step === "review") {
    return (
      <Shell
        title="Review result"
        me={me}
        onBack={() => setStep("form")}
        footer={
          <>
            <PrimaryButton onClick={submit}>Send to {opponent.name}</PrimaryButton>
            <button onClick={() => setStep("form")} className="mt-2 w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Back to edit</button>
          </>
        }
      >
        <ReviewCard me={me} opponent={opponent} date={date} court={court} format={format} sets={sets} dnf={dnf} result={result} />
      </Shell>
    );
  }

  if (step === "sent") {
    return (
      <Shell title="Sent" me={me} onBack={reset}>
        <SentCard me={me} opponent={opponent} date={date} court={court} sets={sets} dnf={dnf} onLogAnother={reset} />
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
          <PlayerPicker me={me} players={players} value={opponent} onChange={setOpponent} />
          <WhenWhere date={date} onDateChange={setDate} court={court} onCourtChange={setCourt} courts={courts} />
          <ScoreSection me={me} opponent={opponent} format={format} sets={sets} dnf={dnf} dnfWinner={dnfWinner} result={result} controls={controls} />
        </div>
      </div>
    </Shell>
  );
}
