import { useEffect, useRef, type ReactNode } from "react";
import { Minus, Plus, Trophy, X } from "lucide-react";
import { Avatar, PointField } from "./ui";
import { cellState, isTiebreakSet, setStatus, colLabel, visibleSetCount } from "./scoring";
import type { CurrentUser, Player, Format, MatchSet, Result, Side, SetKind, CellState } from "./scoring";

// All set/format mutations live in the page; the score components stay presentational.
export interface ScoreControls {
  changeFormat: (f: Format) => void;
  setVal: (i: number, side: Side, v: number) => void;
  setTb: (i: number, side: Side, v: number) => void;
  toggleTb: (i: number) => void;
  setKind: (i: number, kind: SetKind) => void;
  addSet: () => void;
  removeSet: (i: number) => void;
  toggleDnf: () => void;
  setDnfWinner: (w: Side) => void;
}

// ---- Games entry -----------------------------------------------------------

const gamesBoxTone = (state: CellState): string =>
  state === "win"
    ? "border-violet-300 bg-violet-50 text-slate-900 font-extrabold"
    : state === "lose"
      ? "border-slate-200 bg-white text-slate-300 font-bold"
      : "border-slate-200 bg-white text-slate-600 font-bold";

interface ScoreCellProps {
  avatar: ReactNode;
  value: number;
  max: number;
  tone: Side; // only drives the focus-ring colour (you = violet, opp = slate)
  state: CellState;
  placeholder: boolean; // set is still empty — show a muted dash
  editable: boolean;
  ariaLabel: string;
  onChange?: (value: number) => void;
}

// One player's cell in the stacked set row: player avatar + a compact −/value/+ stepper
// (editable) or a static value (read-only). The bordered cell is the tap surface; win/lose/
// neutral tone comes from gamesBoxTone. Scoring behaviour (clamp to 0–max, disabled edges,
// aria) is identical to the old GamesBox/StaticGames — layout/shell only changed.
function ScoreCell({ avatar, value, max, tone, state, placeholder, editable, ariaLabel, onChange }: ScoreCellProps) {
  const ring = tone === "you" ? "focus-visible:ring-violet-500/40" : "focus-visible:ring-slate-400/40";
  const step = `h-8 w-8 grid place-items-center rounded-lg text-slate-500 hover:bg-white active:scale-90 disabled:opacity-25 disabled:hover:bg-transparent transition-all focus-visible:outline-none focus-visible:ring-2 ${ring}`;
  return (
    <div className={`flex items-center justify-between gap-1 rounded-xl border px-2 py-1.5 ${gamesBoxTone(state)}`}>
      {avatar}
      {editable ? (
        <div className="flex items-center gap-0.5">
          <button type="button" className={step} onClick={() => onChange?.(Math.max(0, value - 1))} disabled={value <= 0} aria-label={`Fewer — ${ariaLabel}`}>
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-6 text-center text-xl tabular-nums" aria-label={`${ariaLabel}: ${value}`} aria-live="polite">
            {placeholder ? <span className="text-slate-300">–</span> : value}
          </span>
          <button type="button" className={step} onClick={() => onChange?.(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More — ${ariaLabel}`}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <span className="pr-1 text-xl tabular-nums" aria-label={`${ariaLabel}: ${value}`}>{value}</span>
      )}
    </div>
  );
}

// ---- Set row (one stacked row per set) -------------------------------------

// Deciding-set format choice — shown just above the deciding-set row (in context).
const DECIDERS: { k: SetKind; label: string }[] = [
  { k: "set", label: "Full set" },
  { k: "mtb", label: "Match TB" },
];

interface SetRowProps {
  index: number;
  set: MatchSet;
  format: Format;
  me: CurrentUser;
  opponent: Player | null;
  controls?: ScoreControls | null;
  decider?: boolean; // the deciding set revealed at 1–1 — make it obvious
}

function SetRow({ index, set, format, me, opponent, controls, decider }: SetRowProps) {
  const editable = !!controls;
  const max = set.kind === "mtb" ? 20 : 7;
  const empty = setStatus(set) === "empty";
  // Deciding set awaiting entry — highlight it so users know where to score it.
  const prompt = !!decider && editable && empty;
  const youState = cellState(set, "you");
  const oppState = cellState(set, "opp");
  const label = colLabel(set, index, format);
  const oppName = opponent?.name || "Opponent";

  return (
    <div>
      {prompt && (
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-violet-600">
          <Trophy className="h-3.5 w-3.5 text-violet-500" />It’s 1–1 — enter the deciding set
        </div>
      )}
      {decider && editable && (
        <div className="mb-1.5 inline-flex rounded-full bg-slate-100 p-0.5" role="group" aria-label="Deciding set format">
          {DECIDERS.map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => controls!.setKind(index, t.k)}
              className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                set.kind === t.k ? "bg-violet-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div
        className={`rounded-xl border px-2.5 py-2 ${
          decider ? "border-violet-300 bg-violet-50/60" : "border-slate-200 bg-white"
        } ${prompt ? "ring-2 ring-violet-500/30" : ""}`}
        role="group"
        aria-label={`${label} score${decider ? " (deciding set)" : ""}`}
      >
        {/* Line 1 — header: set label + in-flow winner trophy (no absolute positioning) */}
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium uppercase tracking-[0.05em] ${decider ? "text-violet-500" : "text-slate-400"}`}>{label}</span>
          {(youState === "win" || oppState === "win") && (
            <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
          )}
        </div>
        {/* Line 2 — two stepper cells (you | opp). Two equal columns whenever they fit; at the
            very narrowest widths (≈320px, where the page's nested padding + 32px tap targets
            leave too little room) auto-fit drops to one column so nothing ever overflows. */}
        <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
          <ScoreCell
            avatar={<Avatar name={me.name} size="h-[22px] w-[22px]" text="text-[9px]" />}
            value={set.you}
            max={max}
            tone="you"
            state={youState}
            placeholder={empty}
            editable={editable}
            ariaLabel={`Your games in ${label}`}
            onChange={editable ? (v) => controls!.setVal(index, "you", v) : undefined}
          />
          <ScoreCell
            avatar={<Avatar name={oppName} color={opponent?.color || "bg-slate-200 text-slate-500"} size="h-[22px] w-[22px]" text="text-[9px]" />}
            value={set.opp}
            max={max}
            tone="opp"
            state={oppState}
            placeholder={empty}
            editable={editable}
            ariaLabel={`${oppName} games in ${label}`}
            onChange={editable ? (v) => controls!.setVal(index, "opp", v) : undefined}
          />
        </div>
      </div>

      {isTiebreakSet(set) && (
        <div className="mt-1 flex items-center gap-2 pl-12 text-xs text-slate-500">
          <span className="font-semibold">Tiebreak</span>
          {editable ? (
            set.tb ? (
              <>
                <PointField value={set.tb.you} onChange={(v) => controls!.setTb(index, "you", v)} />
                <span className="text-slate-300">–</span>
                <PointField value={set.tb.opp} onChange={(v) => controls!.setTb(index, "opp", v)} />
                <button onClick={() => controls!.toggleTb(index)} className="grid h-7 w-7 place-items-center text-slate-400 hover:text-rose-500" aria-label="Remove tiebreak points"><X className="h-4 w-4" /></button>
              </>
            ) : (
              <button onClick={() => controls!.toggleTb(index)} className="font-semibold text-violet-500 transition-colors hover:text-violet-700">+ Add tiebreak points (optional)</button>
            )
          ) : set.tb && (set.tb.you || set.tb.opp) ? (
            <span className="tabular-nums">{set.tb.you}–{set.tb.opp}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ---- Stacked board ---------------------------------------------------------

interface BoardProps {
  me: CurrentUser;
  opponent: Player | null;
  sets: MatchSet[];
  format: Format;
  result: Result;
  controls?: ScoreControls | null;
}

// Vertically stacked set rows — no horizontal scroll, ever.
// Editable: shows only the progressively-revealed rows. Read-only: shows the
// sets that were actually played (Review/Sent screens).
function StackedBoard({ me, opponent, sets, format, controls }: BoardProps) {
  const editable = !!controls;
  const visible = editable ? visibleSetCount(sets, format) : 0;
  const rows = sets
    .map((set, index) => ({ set, index }))
    .filter(({ set, index }) =>
      editable ? index < visible : setStatus(set) !== "empty" || (format === "single" && index === 0),
    );

  // Bring a newly-revealed set (especially the deciding set at 1–1) into view so
  // it isn't missed below the fold — the core discoverability fix.
  const lastRowRef = useRef<HTMLDivElement>(null);
  const prevVisible = useRef(visible);
  useEffect(() => {
    if (editable && visible > prevVisible.current && lastRowRef.current) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      lastRowRef.current.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    }
    prevVisible.current = visible;
  }, [visible, editable]);

  return (
    <div className="space-y-1.5" aria-live={editable ? "polite" : undefined}>
      {rows.map(({ set, index }, rowIdx) => (
        <div
          key={index}
          ref={rowIdx === rows.length - 1 ? lastRowRef : undefined}
          className={editable && index > 0 ? "motion-safe:animate-set-reveal" : undefined}
        >
          <SetRow
            index={index}
            set={set}
            format={format}
            me={me}
            opponent={opponent}
            controls={controls}
            decider={editable && format === "bo3" && index === 2}
          />
        </div>
      ))}
    </div>
  );
}

// read-only board for the review / sent screens
export function ReadBoard(props: Omit<BoardProps, "controls">) {
  return <StackedBoard {...props} controls={null} />;
}

interface ResultPillProps {
  me: CurrentUser;
  opponent: Player | null;
  result: Result;
  dnf: boolean;
}

export function ResultPill({ me, opponent, result, dnf }: ResultPillProps) {
  const winnerName = result.winner === "you" ? me.name : opponent?.name;
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 border border-violet-100 px-3.5 py-1.5">
      <Trophy className="h-4 w-4 text-amber-500" />
      <span className="text-sm font-bold text-violet-700">{winnerName} {result.winner === "you" ? "win" : "wins"}</span>
      {!dnf && <span className="text-sm font-medium text-violet-400 tabular-nums">{result.you}–{result.opp}{result.decider === "mtb" ? " · TB" : ""}</span>}
    </div>
  );
}

interface ScoreSectionProps {
  me: CurrentUser;
  opponent: Player | null;
  format: Format;
  sets: MatchSet[];
  dnf: boolean;
  dnfWinner: Side | null;
  result: Result;
  controls: ScoreControls;
}

// full editable score area: format toggle, retirement, stacked board,
// deciding-set kind (revealed at 1–1), and the live result line
export function ScoreSection({ me, opponent, format, sets, dnf, dnfWinner, result, controls }: ScoreSectionProps) {
  const formats: { k: Format; label: string }[] = [{ k: "single", label: "1 set" }, { k: "bo3", label: "Best of 3" }];
  const dnfChoices: { k: Side; name: string }[] = [{ k: "you", name: me.name }, { k: "opp", name: opponent?.name || "Opponent" }];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500"><Trophy className="h-3.5 w-3.5 text-violet-500" />Score</span>
        <button onClick={controls.toggleDnf} className="text-xs font-semibold text-slate-400 hover:text-violet-600 transition-colors">{dnf ? "Enter a score instead" : "Match didn’t finish?"}</button>
      </div>

      {!dnf && (
        <div className="inline-flex rounded-full bg-slate-100 p-1 mb-3">
          {formats.map((f) => (
            <button key={f.k} onClick={() => controls.changeFormat(f.k)} className={`rounded-full px-4 py-1.5 text-sm transition-colors ${format === f.k ? "bg-white font-bold text-violet-700 shadow-sm" : "font-medium text-slate-500 hover:text-slate-700"}`}>{f.label}</button>
          ))}
        </div>
      )}

      {dnf ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600 mb-3">Who won? (Retirement or walkover.)</p>
          <div className="grid grid-cols-2 gap-3">
            {dnfChoices.map((o) => (
              <button key={o.k} onClick={() => controls.setDnfWinner(o.k)} className={`rounded-xl border p-3.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${dnfWinner === o.k ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-600 hover:border-violet-300"}`}>{o.name} won</button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">Counts as a plain win — no margin bonus on the rating.</p>
        </div>
      ) : (
        <>
          <StackedBoard me={me} opponent={opponent} sets={sets} format={format} result={result} controls={controls} />

          {sets.some((s) => s.kind === "mtb") && <p className="mt-2 text-[11px] text-slate-400">Match tiebreak — first to 10, win by 2 · counts as a set won, no margin bonus.</p>}
        </>
      )}

      <div className="mt-3 min-h-[28px]">
        {result.winner ? <ResultPill me={me} opponent={opponent} result={result} dnf={dnf} /> : <p className="text-sm text-slate-400 pt-1">{result.issue}</p>}
      </div>
    </div>
  );
}
