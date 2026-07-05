import { useState, useMemo } from "react";
import { ChevronLeft, ChevronDown, Plus, Minus, Trophy, Check, Search, X, Info, MapPin, Users, CalendarDays, Tag } from "lucide-react";

/* ---- mock data: only players already on The Tennis Plan ---- */
const ME = { name: "Paul", ntrp: "4.5" };
const PLAYERS = [
  { id: 1, name: "Marcus Webb", ntrp: "4.0", color: "bg-rose-100 text-rose-700" },
  { id: 2, name: "Dani Rosen", ntrp: "4.5", color: "bg-sky-100 text-sky-700" },
  { id: 3, name: "Tom Halloway", ntrp: "4.5", color: "bg-amber-100 text-amber-700" },
  { id: 4, name: "Priya Nair", ntrp: "4.0", color: "bg-emerald-100 text-emerald-700" },
  { id: 5, name: "Carlos Mendez", ntrp: "3.5", color: "bg-indigo-100 text-indigo-700" },
];
const COURTS = [
  { name: "Penmar Recreation Center", area: "Venice" },
  { name: "Mar Vista Recreation Center", area: "Mar Vista" },
  { name: "Cheviot Hills Tennis Center", area: "Cheviot Hills" },
  { name: "Stoner Recreation Center", area: "West LA" },
  { name: "Culver City HS Courts", area: "Culver City" },
  { name: "Westwood Recreation Center", area: "Westwood" },
];

const initials = (name) => name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
const newSet = () => ({ kind: "set", you: 0, opp: 0, tb: null });

const localISO = (d = new Date()) => { const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return x.toISOString().slice(0, 10); };
const TODAY = localISO();
const YESTERDAY = localISO(new Date(Date.now() - 86400000));
function prettyDate(iso) {
  if (iso === TODAY) return "Today";
  if (iso === YESTERDAY) return "Yesterday";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function setStatus(s) {
  const { you, opp } = s;
  if (you === 0 && opp === 0) return "empty";
  if (you === opp) return "invalid";
  const hi = Math.max(you, opp), lo = Math.min(you, opp);
  if (s.kind === "mtb") return hi >= 10 && hi - lo >= 2 ? "ok" : "invalid";
  if (hi === 6 && lo <= 4) return "ok";
  if (hi === 7 && (lo === 5 || lo === 6)) return "ok";
  return "invalid";
}
const isTiebreakSet = (s) => s.kind === "set" && ((s.you === 7 && s.opp === 6) || (s.you === 6 && s.opp === 7));
function cellState(s, side) {
  if (setStatus(s) !== "ok") return "neutral";
  const mine = side === "you" ? s.you : s.opp;
  const theirs = side === "you" ? s.opp : s.you;
  return mine > theirs ? "win" : "lose";
}
const cellClass = (state) => state === "win" ? "text-slate-900 font-extrabold" : state === "lose" ? "text-slate-300 font-bold" : "text-slate-600 font-bold";
function fmtSet(s) {
  if (s.kind === "mtb") return `[${s.you}-${s.opp}]`;
  let str = `${s.you}-${s.opp}`;
  if (s.tb && (s.tb.you || s.tb.opp)) str += `(${Math.min(s.tb.you, s.tb.opp)})`;
  return str;
}

const PRIMARY = "w-full rounded-xl bg-gradient-to-b from-violet-500 to-violet-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/30 hover:from-violet-600 hover:to-violet-700 active:scale-[0.99] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50";

function Avatar({ name, color = "bg-violet-100 text-violet-700", size = "h-10 w-10", text = "text-sm" }) {
  return <div className={`${size} ${color} rounded-full grid place-items-center font-semibold ${text} shrink-0`}>{initials(name)}</div>;
}
function YouAvatar({ size = "h-9 w-9", text = "text-sm" }) {
  return <div className={`${size} rounded-full bg-violet-100 text-violet-700 grid place-items-center font-semibold ${text} shrink-0`}>{initials(ME.name)}</div>;
}
function SectionLabel({ icon: Icon, children }) {
  return <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 mb-2"><Icon className="h-3.5 w-3.5 text-violet-500" />{children}</label>;
}

function ScoreCell({ value, max, onChange, tone, state }) {
  const ring = tone === "you" ? "focus-visible:ring-violet-500/40" : "focus-visible:ring-slate-400/40";
  const btn = "h-10 w-10 grid place-items-center rounded-lg text-slate-400 hover:bg-white active:bg-white hover:text-slate-600 disabled:opacity-25 disabled:hover:bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 " + ring;
  return (
    <div className="flex items-center justify-center gap-0.5 px-1 py-1.5">
      <button className={btn} onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0} aria-label="Fewer"><Minus className="h-4 w-4" /></button>
      <span className={`grid place-items-center h-8 w-8 rounded-md text-lg tabular-nums ${cellClass(state)} ${state === "win" ? "bg-white shadow-sm" : ""}`}>{value}</span>
      <button className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="More"><Plus className="h-4 w-4" /></button>
    </div>
  );
}

function PointField({ value, onChange, max = 20 }) {
  return (
    <input inputMode="numeric" value={value}
      onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 2); onChange(d === "" ? 0 : Math.min(max, Number(d))); }}
      className="w-12 text-center text-base sm:text-sm font-bold tabular-nums text-slate-900 rounded-lg border border-slate-200 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40" />
  );
}

function Chip({ active, onClick, children }) {
  return <button onClick={onClick} className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${active ? "bg-violet-600 text-white shadow-sm shadow-violet-600/30" : "bg-slate-100 text-slate-500 hover:text-slate-700"}`}>{children}</button>;
}

export default function LogResult() {
  const [step, setStep] = useState("form");
  const [opponent, setOpponent] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [date, setDate] = useState(TODAY);
  const [location, setLocation] = useState(null);
  const [locOpen, setLocOpen] = useState(false);
  const [locQuery, setLocQuery] = useState("");
  const [format, setFormat] = useState("bo3");
  const [sets, setSets] = useState([newSet(), newSet()]);
  const [dnf, setDnf] = useState(false);
  const [dnfWinner, setDnfWinner] = useState(null);

  const changeFormat = (f) => {
    setFormat(f);
    setSets((prev) => {
      if (f === "single") return [{ ...prev[0], kind: "set" }];
      const arr = prev.slice(0, 3).map((s) => ({ ...s }));
      while (arr.length < 2) arr.push(newSet());
      return arr;
    });
  };
  const setVal = (i, side, v) => setSets((s) => s.map((row, idx) => (idx === i ? { ...row, [side]: v } : row)));
  const setTb = (i, side, v) => setSets((s) => s.map((row, idx) => (idx === i ? { ...row, tb: { ...(row.tb || { you: 0, opp: 0 }), [side]: v } } : row)));
  const toggleTb = (i) => setSets((s) => s.map((row, idx) => (idx === i ? { ...row, tb: row.tb ? null : { you: 0, opp: 0 } } : row)));
  const setKind = (i, kind) => setSets((s) => s.map((row, idx) => (idx === i ? { kind, you: 0, opp: 0, tb: null } : row)));
  const addSet = () => setSets((s) => (s.length < 3 ? [...s, newSet()] : s));
  const removeSet = (i) => setSets((s) => s.filter((_, idx) => idx !== i));

  const result = useMemo(() => {
    if (dnf) return { complete: !!dnfWinner, winner: dnfWinner, you: 0, opp: 0, issue: dnfWinner ? null : "Pick who won.", decider: null };
    const target = format === "single" ? 1 : 2;
    let you = 0, opp = 0, anyInvalid = false, decider = null;
    const entered = sets.filter((s) => setStatus(s) !== "empty");
    for (const s of entered) {
      if (setStatus(s) !== "ok") { anyInvalid = true; continue; }
      if (s.you > s.opp) you++; else opp++;
      if (s.kind === "mtb") decider = "mtb";
    }
    const winner = !anyInvalid && Math.max(you, opp) === target ? (you > opp ? "you" : "opp") : null;
    let issue = null;
    if (entered.length === 0) issue = format === "single" ? "Enter the games." : "Enter the games for each set.";
    else if (anyInvalid) issue = "Check the set scores — e.g. 6-4, 7-5 or 7-6.";
    else if (!winner) issue = format === "single" ? "Finish the set." : "Needs a 2-set winner.";
    return { complete: !!winner, winner, you, opp, issue, decider };
  }, [sets, dnf, dnfWinner, format]);

  const valid = opponent && location && result.complete;
  const oppName = opponent ? opponent.name : "your opponent";
  const winnerName = result.winner === "you" ? ME.name : opponent?.name;
  const filtered = PLAYERS.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  const filteredCourts = COURTS.filter((c) => (c.name + c.area).toLowerCase().includes(locQuery.toLowerCase()));
  const scoreString = dnf ? "Retired" : sets.filter((s) => setStatus(s) !== "empty").map(fmtSet).join("  ");
  const colLabel = (s, i) => (s.kind === "mtb" ? "TB" : format === "single" ? "Set" : `Set ${i + 1}`);
  const tmpl = `minmax(84px,1fr) ${sets.map(() => "auto").join(" ")}`;
  const missing = !opponent ? "Choose your opponent to continue." : !location ? "Choose a court to continue." : !result.complete ? "Finish entering the score." : "You’ll check it on the next screen before it’s sent.";

  const reset = () => { setStep("form"); setOpponent(null); setDate(TODAY); setLocation(null); changeFormat("bo3"); setSets([newSet(), newSet()]); setDnf(false); setDnfWinner(null); };

  const ResultPill = () => (
    <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 border border-violet-100 px-3.5 py-1.5">
      <Trophy className="h-4 w-4 text-amber-500" />
      <span className="text-sm font-bold text-violet-700">{winnerName} {result.winner === "you" ? "win" : "wins"}</span>
      {!dnf && <span className="text-sm font-medium text-violet-400 tabular-nums">{result.you}–{result.opp}{result.decider === "mtb" ? " · TB" : ""}</span>}
    </div>
  );

  const ReadBoard = () => (
    <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
      <div className="grid min-w-max" style={{ gridTemplateColumns: tmpl }}>
        <div className="bg-slate-50 border-b border-slate-100" />
        {sets.map((s, i) => (<div key={"h" + i} className="bg-slate-50 border-b border-l border-slate-100 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">{colLabel(s, i)}</div>))}
        <div className="flex items-center gap-2 px-3 py-2.5 bg-violet-50 border-l-4 border-violet-400 min-w-0">
          <YouAvatar size="h-8 w-8" />
          <div className="flex items-center gap-1.5 min-w-0"><span className="text-sm font-bold text-slate-900 truncate">{ME.name}</span>{result.winner === "you" && <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />}</div>
        </div>
        {sets.map((s, i) => (<div key={"y" + i} className="bg-violet-50 border-l border-slate-100 grid place-items-center py-2.5"><span className={`grid place-items-center h-8 w-8 rounded-md text-lg tabular-nums ${cellClass(cellState(s, "you"))} ${cellState(s, "you") === "win" ? "bg-white shadow-sm" : ""}`}>{s.you}</span></div>))}
        <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border-l-4 border-slate-300 border-t border-slate-200 min-w-0">
          <Avatar name={opponent.name} color={opponent.color} size="h-8 w-8" />
          <div className="flex items-center gap-1.5 min-w-0"><span className="text-sm font-bold text-slate-900 truncate">{opponent.name}</span>{result.winner === "opp" && <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />}</div>
        </div>
        {sets.map((s, i) => (<div key={"o" + i} className="bg-slate-50 border-l border-slate-100 border-t border-slate-200 grid place-items-center py-2.5"><span className={`grid place-items-center h-8 w-8 rounded-md text-lg tabular-nums ${cellClass(cellState(s, "opp"))} ${cellState(s, "opp") === "win" ? "bg-white shadow-sm" : ""}`}>{s.opp}</span></div>))}
      </div>
    </div>
  );

  /* ---------------- review ---------------- */
  if (step === "review") {
    return (
      <Shell title="Review result" onBack={() => setStep("form")} footer={
        <>
          <button onClick={() => setStep("sent")} className={PRIMARY}>Send to {opponent.name}</button>
          <button onClick={() => setStep("form")} className="mt-2 w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Back to edit</button>
        </>
      }>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-md shadow-slate-200/60 space-y-5">
          <p className="text-center text-sm text-slate-500">Check this is right — it’s what {opponent.name} will be asked to confirm.</p>
          <div className="flex items-center justify-center gap-5">
            <div className="flex flex-col items-center gap-1.5"><YouAvatar size="h-14 w-14" text="text-base" /><span className="text-xs font-semibold text-slate-700">{ME.name}</span></div>
            <span className="text-sm font-bold text-slate-300">vs</span>
            <div className="flex flex-col items-center gap-1.5"><Avatar name={opponent.name} color={opponent.color} size="h-14 w-14" text="text-base" /><span className="text-xs font-semibold text-slate-700">{opponent.name}</span></div>
          </div>
          {dnf ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <span className="text-sm font-semibold text-slate-900">{winnerName} won</span>
              <p className="mt-0.5 text-xs text-slate-400">Retirement / walkover · no margin bonus</p>
            </div>
          ) : <ReadBoard />}
          <div className="flex justify-center"><ResultPill /></div>
          <div className="flex items-center justify-center gap-3 text-sm text-slate-500 border-t border-slate-100 pt-4">
            <span className="font-semibold text-slate-700">{prettyDate(date)}</span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-violet-500" />{location.name}</span>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs leading-relaxed text-amber-800">
            <Info className="h-4 w-4 mt-px shrink-0 text-amber-500" />
            {opponent.name} gets a text to confirm. No reply within 48 hours and it’s confirmed automatically — they can dispute it in that window.
          </div>
        </div>
      </Shell>
    );
  }

  /* ---------------- sent ---------------- */
  if (step === "sent") {
    return (
      <Shell title="Sent" onBack={reset}>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-md shadow-slate-200/60 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 grid place-items-center shadow-lg shadow-violet-600/30"><Check className="h-7 w-7 text-white" /></div>
          <h2 className="text-lg font-bold text-slate-900">Result sent to {opponent.name}</h2>
          <p className="mt-1.5 text-sm text-slate-500">They’ll get a text to confirm it. You’ll see the rating move once it’s confirmed.</p>
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-left">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">Awaiting confirmation</span>
              <span className="text-xs font-medium text-slate-400">just now</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <YouAvatar />
              <span className="text-base font-extrabold text-slate-900 tabular-nums">{scoreString}</span>
              <Avatar name={opponent.name} color={opponent.color} />
            </div>
            <div className="mt-2.5 flex items-center gap-3 text-xs font-medium text-slate-500">
              <span>{prettyDate(date)}</span>
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-violet-500" />{location.name}</span>
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-slate-500 border-t border-amber-200/70 pt-3">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
              No response within 48 hours and it’s confirmed automatically. {opponent.name} can dispute it in that window.
            </p>
          </div>
          <button onClick={reset} className={`${PRIMARY} mt-5`}>Log another result</button>
        </div>
      </Shell>
    );
  }

  /* ---------------- form ---------------- */
  const footer = (
    <>
      <button disabled={!valid} onClick={() => setStep("review")} className={`w-full rounded-xl py-3.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 ${valid ? "bg-gradient-to-b from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-600/30 hover:from-violet-600 hover:to-violet-700 active:scale-[0.99]" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}>Review result</button>
      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-slate-400"><Info className="h-3.5 w-3.5 mt-px shrink-0" />{missing}</p>
    </>
  );

  return (
    <Shell title="Log a result" footer={footer}>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-md shadow-slate-200/60 overflow-hidden">
        <div className="px-4 sm:px-6 pt-4 pb-3.5 border-b border-slate-100"><p className="text-sm text-slate-500">Enter the score, then send it to your opponent to confirm.</p></div>

        <div className="px-4 sm:px-6 py-5 sm:py-6 space-y-6">
          {/* match type */}
          <div>
            <SectionLabel icon={Tag}>Match type</SectionLabel>
            <div className="inline-flex rounded-full bg-slate-100 p-1">
              <button className="rounded-full bg-white px-4 py-2 text-sm font-bold text-violet-700 shadow-sm">Casual</button>
              <button disabled className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-slate-400 cursor-not-allowed">League <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">Soon</span></button>
            </div>
          </div>

          {/* players */}
          <div>
            <SectionLabel icon={Users}>Players</SectionLabel>
            <div className="flex items-stretch gap-2.5">
              <div className="flex-1 rounded-xl border border-violet-200 bg-violet-50 p-3 flex items-center gap-2.5 min-w-0">
                <YouAvatar size="h-9 w-9" />
                <div className="min-w-0"><div className="text-sm font-bold text-slate-900 truncate">{ME.name}</div><div className="text-[11px] font-semibold text-violet-600">You</div></div>
              </div>
              <div className="grid place-items-center text-xs font-bold text-slate-400 px-0.5">vs</div>
              <div className="flex-1 min-w-0">
                {opponent ? (
                  <button onClick={() => setPickerOpen((o) => !o)} className="w-full h-full rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-2.5 text-left hover:border-violet-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 min-w-0">
                    <Avatar name={opponent.name} color={opponent.color} size="h-9 w-9" />
                    <div className="min-w-0 flex-1"><div className="text-sm font-bold text-slate-900 truncate">{opponent.name}</div><div className="text-[11px] text-slate-500">NTRP {opponent.ntrp}</div></div>
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  </button>
                ) : (
                  <button onClick={() => setPickerOpen((o) => !o)} className="w-full h-full min-h-[60px] rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/40 px-3 flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:border-violet-400 hover:bg-violet-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40">
                    <Plus className="h-4 w-4 shrink-0" /> Choose player
                  </button>
                )}
              </div>
            </div>
            {pickerOpen && (
              <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search players" className="w-full text-base sm:text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none" />
                  <button onClick={() => setPickerOpen(false)} aria-label="Close" className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
                </div>
                <ul className="max-h-56 overflow-y-auto py-1">
                  {filtered.map((p) => (
                    <li key={p.id}><button onClick={() => { setOpponent(p); setPickerOpen(false); setQuery(""); }} className="w-full flex items-center gap-3 px-3 py-3 hover:bg-violet-50/60 transition-colors text-left">
                      <Avatar name={p.name} color={p.color} size="h-9 w-9" />
                      <div className="min-w-0"><div className="text-sm font-semibold text-slate-900 truncate">{p.name}</div><div className="text-xs text-slate-500">NTRP {p.ntrp}</div></div>
                    </button></li>
                  ))}
                  {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">No players match “{query}”.</li>}
                </ul>
              </div>
            )}
            <p className="mt-2 text-xs text-slate-400">Only players already on The Tennis Plan can be picked.</p>
          </div>

          {/* when & where */}
          <div>
            <SectionLabel icon={CalendarDays}>When &amp; where</SectionLabel>
            <div className="flex items-center gap-2 flex-wrap">
              <Chip active={date === TODAY} onClick={() => setDate(TODAY)}>Today</Chip>
              <Chip active={date === YESTERDAY} onClick={() => setDate(YESTERDAY)}>Yesterday</Chip>
              <input type="date" max={TODAY} value={date} onChange={(e) => setDate(e.target.value || TODAY)} className="ml-auto rounded-lg border border-slate-200 px-2.5 py-2 text-base sm:text-sm font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40" />
            </div>
            <div className="mt-2.5">
              {location ? (
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 grid place-items-center shrink-0 shadow-sm shadow-violet-600/30"><MapPin className="h-4 w-4 text-white" /></div>
                  <div className="min-w-0 flex-1"><div className="text-sm font-bold text-slate-900 truncate">{location.name}</div><div className="text-xs text-slate-500">{location.area}</div></div>
                  <button onClick={() => setLocation(null)} className="grid h-8 w-8 place-items-center text-slate-300 hover:text-rose-500 transition-colors" aria-label="Change court"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <button onClick={() => setLocOpen((o) => !o)} className="w-full rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-3 flex items-center gap-2 text-sm font-semibold text-violet-600 hover:border-violet-400 hover:bg-violet-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40">
                  <MapPin className="h-4 w-4 shrink-0" /> Choose a court
                </button>
              )}
              {locOpen && !location && (
                <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input autoFocus value={locQuery} onChange={(e) => setLocQuery(e.target.value)} placeholder="Search courts" className="w-full text-base sm:text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none" />
                    <button onClick={() => setLocOpen(false)} aria-label="Close" className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
                  </div>
                  <ul className="max-h-56 overflow-y-auto py-1">
                    {filteredCourts.map((c) => (
                      <li key={c.name}><button onClick={() => { setLocation(c); setLocOpen(false); setLocQuery(""); }} className="w-full flex items-center gap-3 px-3 py-3 hover:bg-violet-50/60 transition-colors text-left">
                        <div className="h-8 w-8 rounded-lg bg-violet-100 grid place-items-center shrink-0"><MapPin className="h-4 w-4 text-violet-600" /></div>
                        <div className="min-w-0"><div className="text-sm font-semibold text-slate-900 truncate">{c.name}</div><div className="text-xs text-slate-500">{c.area}</div></div>
                      </button></li>
                    ))}
                    {filteredCourts.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">No courts match “{locQuery}”.</li>}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* score */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <SectionLabel icon={Trophy}>Score</SectionLabel>
              <button onClick={() => { setDnf((d) => !d); setDnfWinner(null); }} className="text-xs font-semibold text-slate-400 hover:text-violet-600 transition-colors">{dnf ? "Enter a score instead" : "Match didn’t finish?"}</button>
            </div>
            {!dnf && (
              <div className="inline-flex rounded-full bg-slate-100 p-1 mb-3">
                {[{ k: "single", label: "1 set" }, { k: "bo3", label: "Best of 3" }].map((f) => (
                  <button key={f.k} onClick={() => changeFormat(f.k)} className={`rounded-full px-4 py-2 text-sm transition-colors ${format === f.k ? "bg-white font-bold text-violet-700 shadow-sm" : "font-medium text-slate-500 hover:text-slate-700"}`}>{f.label}</button>
                ))}
              </div>
            )}
            {dnf ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-600 mb-3">Who won? (Retirement or walkover.)</p>
                <div className="grid grid-cols-2 gap-3">
                  {[{ k: "you", name: ME.name }, { k: "opp", name: opponent?.name || "Opponent" }].map((o) => (
                    <button key={o.k} onClick={() => setDnfWinner(o.k)} className={`rounded-xl border p-3.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${dnfWinner === o.k ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-600 hover:border-violet-300"}`}>{o.name} won</button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-400">Counts as a plain win — no margin bonus on the rating.</p>
              </div>
            ) : (
              <>
                {format === "bo3" && sets.length === 3 && (
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mr-1">Deciding</span>
                    {[{ k: "set", label: "Full set" }, { k: "mtb", label: "Match TB" }].map((t) => (
                      <button key={t.k} onClick={() => setKind(2, t.k)} className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${sets[2].kind === t.k ? "bg-violet-600 text-white shadow-sm shadow-violet-600/30" : "text-slate-400 hover:text-slate-600"}`}>{t.label}</button>
                    ))}
                    <button onClick={() => removeSet(2)} className="ml-auto grid h-7 w-7 place-items-center text-slate-300 hover:text-rose-500 transition-colors" aria-label="Remove deciding set"><X className="h-4 w-4" /></button>
                  </div>
                )}
                <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
                  <div className="grid min-w-max" style={{ gridTemplateColumns: tmpl }}>
                    <div className="bg-slate-50 border-b border-slate-100" />
                    {sets.map((s, i) => (<div key={"h" + i} className="bg-slate-50 border-b border-l border-slate-100 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">{colLabel(s, i)}</div>))}
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-violet-50 border-l-4 border-violet-400 min-w-0">
                      <YouAvatar size="h-8 w-8" />
                      <div className="min-w-0"><div className="flex items-center gap-1.5"><span className="text-sm font-bold text-slate-900 truncate">{ME.name}</span>{result.winner === "you" && <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />}</div><div className="text-[11px] font-semibold text-violet-600">You</div></div>
                    </div>
                    {sets.map((s, i) => (<div key={"y" + i} className="bg-violet-50 border-l border-slate-100 flex items-center justify-center"><ScoreCell tone="you" value={s.you} max={s.kind === "mtb" ? 20 : 7} onChange={(v) => setVal(i, "you", v)} state={cellState(s, "you")} /></div>))}
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border-l-4 border-slate-300 border-t border-slate-200 min-w-0">
                      <Avatar name={opponent?.name || "Opponent"} color={opponent?.color || "bg-slate-200 text-slate-500"} size="h-8 w-8" />
                      <div className="min-w-0"><div className="flex items-center gap-1.5"><span className={`text-sm font-bold truncate ${opponent ? "text-slate-900" : "text-slate-400"}`}>{opponent?.name || "Opponent"}</span>{result.winner === "opp" && <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />}</div><div className="text-[11px] text-slate-400">{opponent ? `NTRP ${opponent.ntrp}` : "Not picked"}</div></div>
                    </div>
                    {sets.map((s, i) => (<div key={"o" + i} className="bg-slate-50 border-l border-slate-100 border-t border-slate-200 flex items-center justify-center"><ScoreCell tone="opp" value={s.opp} max={s.kind === "mtb" ? 20 : 7} onChange={(v) => setVal(i, "opp", v)} state={cellState(s, "opp")} /></div>))}
                  </div>
                </div>
                {format === "bo3" && sets.length < 3 && (
                  <button onClick={addSet} className="mt-2 w-full flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-violet-600 rounded-lg border-2 border-dashed border-violet-200 bg-violet-50/40 hover:border-violet-400 hover:bg-violet-50 transition-colors"><Plus className="h-4 w-4" /> Add deciding set</button>
                )}
                {sets.some((s) => s.kind === "mtb") && <p className="mt-2 text-[11px] text-slate-400">Match tiebreak — first to 10, win by 2 · counts as a set won, no margin bonus.</p>}
                {sets.some(isTiebreakSet) && (
                  <div className="mt-3 space-y-1.5">
                    {sets.map((s, i) => isTiebreakSet(s) ? (
                      <div key={"tb" + i} className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold w-16">Set {i + 1} TB</span>
                        {s.tb ? (<><PointField value={s.tb.you} onChange={(v) => setTb(i, "you", v)} /><span className="text-slate-300">–</span><PointField value={s.tb.opp} onChange={(v) => setTb(i, "opp", v)} /><button onClick={() => toggleTb(i)} className="grid h-7 w-7 place-items-center text-slate-400 hover:text-rose-500" aria-label="Remove"><X className="h-4 w-4" /></button></>) : (<button onClick={() => toggleTb(i)} className="font-semibold text-violet-500 hover:text-violet-700 transition-colors">+ Add tiebreak points (optional)</button>)}
                      </div>
                    ) : null)}
                  </div>
                )}
              </>
            )}
            <div className="mt-3 min-h-[28px]">
              {result.winner ? <ResultPill /> : <p className="text-sm text-slate-400 pt-1">{result.issue}</p>}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ title, children, footer, onBack }) {
  return (
    <div className="min-h-screen bg-slate-100 font-sans antialiased flex flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto w-full max-w-lg flex items-center gap-2 px-3 sm:px-6 py-2.5">
          <button onClick={onBack} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors" aria-label="Back"><ChevronLeft className="h-5 w-5" /></button>
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-lime-300 to-emerald-500 grid place-items-center shadow-sm shrink-0"><div className="h-4 w-4 rounded-full bg-white/90 ring-1 ring-emerald-700/20" /></div>
          <h1 className="text-base font-bold text-slate-900">{title}</h1>
          <div className="ml-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5">
            <YouAvatar size="h-7 w-7" text="text-xs" />
            <span className="text-xs font-bold text-slate-700">{ME.ntrp}</span>
          </div>
        </div>
      </header>
      <main className="flex-1 w-full">
        <div className="mx-auto w-full max-w-lg px-4 sm:px-6 py-5 sm:py-8">{children}</div>
      </main>
      {footer && (
        <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="mx-auto w-full max-w-lg px-4 sm:px-6 pt-3 pb-4">{footer}</div>
        </div>
      )}
    </div>
  );
}
