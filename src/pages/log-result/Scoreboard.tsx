import { Plus, Minus, Trophy, X } from "lucide-react";
import { Avatar, PointField } from "./ui";
import { cellState, cellClass, isTiebreakSet, boardTemplate, colLabel } from "./scoring";
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

interface ScoreCellProps {
  value: number;
  max: number;
  onChange: (value: number) => void;
  tone: Side;
  state: CellState;
}

export function ScoreCell({ value, max, onChange, tone, state }: ScoreCellProps) {
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

interface BoardProps {
  me: CurrentUser;
  opponent: Player | null;
  sets: MatchSet[];
  format: Format;
  result: Result;
  controls?: ScoreControls | null;
}

// shared scoreboard rows; `editable` swaps static numbers for ScoreCell steppers
function Board({ me, opponent, sets, format, result, controls }: BoardProps) {
  const editable = !!controls;
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
      <div className="grid min-w-max" style={{ gridTemplateColumns: boardTemplate(sets) }}>
        <div className="bg-slate-50 border-b border-slate-100" />
        {sets.map((s, i) => (
          <div key={"h" + i} className="bg-slate-50 border-b border-l border-slate-100 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">{colLabel(s, i, format)}</div>
        ))}

        {/* you */}
        <div className="flex items-center gap-2 px-3 py-2.5 bg-violet-50 border-l-4 border-violet-400 min-w-0">
          <Avatar name={me.name} size="h-8 w-8" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5"><span className="text-sm font-bold text-slate-900 truncate">{me.name}</span>{result.winner === "you" && <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />}</div>
            <div className="text-[11px] font-semibold text-violet-600">You</div>
          </div>
        </div>
        {sets.map((s, i) => (
          <div key={"y" + i} className="bg-violet-50 border-l border-slate-100 grid place-items-center">
            {editable
              ? <ScoreCell tone="you" value={s.you} max={s.kind === "mtb" ? 20 : 7} onChange={(v) => controls!.setVal(i, "you", v)} state={cellState(s, "you")} />
              : <span className={`grid place-items-center h-8 w-8 my-2.5 rounded-md text-lg tabular-nums ${cellClass(cellState(s, "you"))} ${cellState(s, "you") === "win" ? "bg-white shadow-sm" : ""}`}>{s.you}</span>}
          </div>
        ))}

        {/* opponent */}
        <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border-l-4 border-slate-300 border-t border-slate-200 min-w-0">
          <Avatar name={opponent?.name || "Opponent"} color={opponent?.color || "bg-slate-200 text-slate-500"} size="h-8 w-8" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5"><span className={`text-sm font-bold truncate ${opponent ? "text-slate-900" : "text-slate-400"}`}>{opponent?.name || "Opponent"}</span>{result.winner === "opp" && <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />}</div>
            <div className="text-[11px] text-slate-400">{opponent ? `NTRP ${opponent.ntrp}` : "Not picked"}</div>
          </div>
        </div>
        {sets.map((s, i) => (
          <div key={"o" + i} className="bg-slate-50 border-l border-slate-100 border-t border-slate-200 grid place-items-center">
            {editable
              ? <ScoreCell tone="opp" value={s.opp} max={s.kind === "mtb" ? 20 : 7} onChange={(v) => controls!.setVal(i, "opp", v)} state={cellState(s, "opp")} />
              : <span className={`grid place-items-center h-8 w-8 my-2.5 rounded-md text-lg tabular-nums ${cellClass(cellState(s, "opp"))} ${cellState(s, "opp") === "win" ? "bg-white shadow-sm" : ""}`}>{s.opp}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// read-only board for the review screen
export function ReadBoard(props: Omit<BoardProps, "controls">) {
  return <Board {...props} controls={null} />;
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

// full editable score area: format toggle, retirement, board, deciding controls,
// optional set-tiebreak points, and the live result line
export function ScoreSection({ me, opponent, format, sets, dnf, dnfWinner, result, controls }: ScoreSectionProps) {
  const formats: { k: Format; label: string }[] = [{ k: "single", label: "1 set" }, { k: "bo3", label: "Best of 3" }];
  const deciders: { k: SetKind; label: string }[] = [{ k: "set", label: "Full set" }, { k: "mtb", label: "Match TB" }];
  const dnfChoices: { k: Side; name: string }[] = [{ k: "you", name: me.name }, { k: "opp", name: opponent?.name || "Opponent" }];
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500"><Trophy className="h-3.5 w-3.5 text-violet-500" />Score</span>
        <button onClick={controls.toggleDnf} className="text-xs font-semibold text-slate-400 hover:text-violet-600 transition-colors">{dnf ? "Enter a score instead" : "Match didn’t finish?"}</button>
      </div>

      {!dnf && (
        <div className="inline-flex rounded-full bg-slate-100 p-1 mb-3">
          {formats.map((f) => (
            <button key={f.k} onClick={() => controls.changeFormat(f.k)} className={`rounded-full px-4 py-2 text-sm transition-colors ${format === f.k ? "bg-white font-bold text-violet-700 shadow-sm" : "font-medium text-slate-500 hover:text-slate-700"}`}>{f.label}</button>
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
          {format === "bo3" && sets.length === 3 && (
            <div className="flex items-center gap-1 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mr-1">Deciding</span>
              {deciders.map((t) => (
                <button key={t.k} onClick={() => controls.setKind(2, t.k)} className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${sets[2].kind === t.k ? "bg-violet-600 text-white shadow-sm shadow-violet-600/30" : "text-slate-400 hover:text-slate-600"}`}>{t.label}</button>
              ))}
              <button onClick={() => controls.removeSet(2)} className="ml-auto grid h-7 w-7 place-items-center text-slate-300 hover:text-rose-500 transition-colors" aria-label="Remove deciding set"><X className="h-4 w-4" /></button>
            </div>
          )}

          <Board me={me} opponent={opponent} sets={sets} format={format} result={result} controls={controls} />

          {format === "bo3" && sets.length < 3 && (
            <button onClick={controls.addSet} className="mt-2 w-full flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-violet-600 rounded-lg border-2 border-dashed border-violet-200 bg-violet-50/40 hover:border-violet-400 hover:bg-violet-50 transition-colors"><Plus className="h-4 w-4" /> Add deciding set</button>
          )}
          {sets.some((s) => s.kind === "mtb") && <p className="mt-2 text-[11px] text-slate-400">Match tiebreak — first to 10, win by 2 · counts as a set won, no margin bonus.</p>}
          {sets.some(isTiebreakSet) && (
            <div className="mt-3 space-y-1.5">
              {sets.map((s, i) => isTiebreakSet(s) ? (
                <div key={"tb" + i} className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold w-16">Set {i + 1} TB</span>
                  {s.tb ? (
                    <>
                      <PointField value={s.tb.you} onChange={(v) => controls.setTb(i, "you", v)} />
                      <span className="text-slate-300">–</span>
                      <PointField value={s.tb.opp} onChange={(v) => controls.setTb(i, "opp", v)} />
                      <button onClick={() => controls.toggleTb(i)} className="grid h-7 w-7 place-items-center text-slate-400 hover:text-rose-500" aria-label="Remove"><X className="h-4 w-4" /></button>
                    </>
                  ) : (
                    <button onClick={() => controls.toggleTb(i)} className="font-semibold text-violet-500 hover:text-violet-700 transition-colors">+ Add tiebreak points (optional)</button>
                  )}
                </div>
              ) : null)}
            </div>
          )}
        </>
      )}

      <div className="mt-3 min-h-[28px]">
        {result.winner ? <ResultPill me={me} opponent={opponent} result={result} dnf={dnf} /> : <p className="text-sm text-slate-400 pt-1">{result.issue}</p>}
      </div>
    </div>
  );
}
