import { useEffect, useState } from "react";
import { Avatar } from "./ui";
import { cellState, setStatus } from "./scoring";
import type { CurrentUser, Format, MatchSet, Player, Result, Side } from "./scoring";
import { FORMAT_CHIPS, activeChip, cleanCell, setFromCells, thirdSetOpen, winnerLine } from "./scoreGridRules";
import type { FormatChip } from "./scoreGridRules";

// Home v2 (§6.5): the score as a grid, You and the opponent down the side, sets across, every
// cell a real numeric input with its own label. Typed text is kept here so a half-entered set
// stays half-entered; the page only ever sees whole sets (scoreGridRules.setFromCells).

interface ScoreGridProps {
  me: CurrentUser;
  opponent: Player | null;
  format: Format;
  sets: MatchSet[];
  dnf: boolean;
  dnfWinner: Side | null;
  result: Result;
  onSet: (index: number, set: MatchSet) => void;
  onChip: (chip: FormatChip) => void;
  onFormat: (format: Format) => void;
  onDnfWinner: (side: Side) => void;
}

type Drafts = Record<string, string>;
const cellKey = (index: number, side: Side) => `${index}-${side}`;

const columnLabel = (set: MatchSet, index: number, format: Format) =>
  format === "single" ? "Set" : index === 2 && set.kind === "mtb" ? "Tiebreak" : `Set ${index + 1}`;

const cellTone = (set: MatchSet, side: Side) => {
  const state = cellState(set, side);
  return state === "win" ? "font-extrabold text-[var(--v2-ink)]" : state === "lose" ? "font-semibold text-[var(--v2-ink-2)]" : "font-bold text-[var(--v2-ink)]";
};

export function ScoreGrid({ me, opponent, format, sets, dnf, dnfWinner, result, onSet, onChip, onFormat, onDnfWinner }: ScoreGridProps) {
  const [drafts, setDrafts] = useState<Drafts>({});
  const oppName = opponent?.name || "Opponent";
  const chip = activeChip(sets, dnf);
  const thirdOpen = thirdSetOpen(sets, format);
  const columns = format === "single" ? sets.slice(0, 1) : sets.slice(0, 3);
  const line = winnerLine({ result, sets, dnf, opponentName: oppName });

  // The third set closes again if set 1 or 2 changes so it's no longer one set all; the page
  // clears its numbers (LogResultPage), and the typed text goes with them.
  useEffect(() => {
    if (thirdOpen) return;
    setDrafts((current) =>
      current[cellKey(2, "you")] || current[cellKey(2, "opp")]
        ? { ...current, [cellKey(2, "you")]: "", [cellKey(2, "opp")]: "" }
        : current,
    );
  }, [thirdOpen]);

  const type = (index: number, side: Side, raw: string) => {
    const set = sets[index];
    const value = cleanCell(raw, set.kind);
    const next = { ...drafts, [cellKey(index, side)]: value };
    setDrafts(next);
    onSet(index, setFromCells(set.kind, next[cellKey(index, "you")] ?? "", next[cellKey(index, "opp")] ?? ""));
  };

  const pickChip = (key: FormatChip) => {
    // A new deciding-set format starts that set over.
    if (key !== "retired" && key !== sets[2]?.kind) {
      setDrafts((current) => ({ ...current, [cellKey(2, "you")]: "", [cellKey(2, "opp")]: "" }));
    }
    onChip(key);
  };

  const rows: { side: Side; name: string; color?: string }[] = [
    { side: "you", name: "You" },
    { side: "opp", name: oppName, color: opponent?.color || "bg-slate-200 text-slate-600" },
  ];

  return (
    <div>
      <h2 className="mb-2 text-[17px] font-bold text-[var(--v2-ink)]">Score</h2>

      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Match format">
        {FORMAT_CHIPS.filter((item) => format === "bo3" || item.key === "retired").map((item) => {
          const on = item.key === chip;
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={on}
              onClick={() => (on && item.key === "retired" ? onChip(sets[2]?.kind === "mtb" ? "mtb" : "set") : pickChip(item.key))}
              className={`min-h-[44px] rounded-full border-[1.5px] px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--v2-primary)] ${
                on
                  ? "border-[var(--v2-primary)] bg-[var(--v2-primary-tint)] text-[var(--v2-primary)]"
                  : "border-[var(--v2-border)] bg-white text-[var(--v2-ink-2)]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {dnf ? (
        <div className="rounded-[18px] border border-[var(--v2-border)] bg-white p-4">
          <p className="mb-3 text-sm text-[var(--v2-ink-2)]">Who won?</p>
          <div className="grid grid-cols-2 gap-2">
            {rows.map((row) => (
              <button
                key={row.side}
                type="button"
                aria-pressed={dnfWinner === row.side}
                onClick={() => onDnfWinner(row.side)}
                className={`min-h-[44px] rounded-xl border-[1.5px] px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--v2-primary)] ${
                  dnfWinner === row.side
                    ? "border-[var(--v2-primary)] bg-[var(--v2-primary-tint)] text-[var(--v2-primary)]"
                    : "border-[var(--v2-primary-border)] bg-white text-[var(--v2-primary)]"
                }`}
              >
                {row.side === "you" ? "I won" : `${oppName} won`}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--v2-ink-2)]">Counts as a plain win, with no margin bonus on the rating.</p>
        </div>
      ) : (
        <div>
          <table className="-mx-1 w-[calc(100%+8px)] table-fixed border-separate border-spacing-1">
            <thead>
              <tr>
                <th scope="col" className="w-auto">
                  <span className="sr-only">Player</span>
                </th>
                {columns.map((set, index) => (
                  <th
                    key={index}
                    scope="col"
                    className="w-[52px] whitespace-nowrap text-center text-[11px] font-bold uppercase text-[var(--v2-ink-2)]"
                  >
                    {columnLabel(set, index, format)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.side}>
                  <th scope="row" className="text-left font-normal">
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar name={row.side === "you" ? me.name : row.name} color={row.color} size="h-8 w-8" text="text-xs" />
                      <span className="truncate text-[15px] font-bold text-[var(--v2-ink)]">{row.name}</span>
                    </span>
                  </th>
                  {columns.map((set, index) => {
                    const id = `score-${row.side}-${index}`;
                    const locked = index === 2 && !thirdOpen;
                    const label = columnLabel(set, index, format).toLowerCase();
                    const unit = set.kind === "mtb" ? "points" : "games";
                    return (
                      <td key={index} className="p-0">
                        <label htmlFor={id} className="sr-only">
                          {row.side === "you" ? `Your ${unit}` : `${oppName}'s ${unit}`}, {label}
                          {locked ? " (only at one set all)" : ""}
                        </label>
                        <input
                          id={id}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="off"
                          disabled={locked}
                          placeholder={locked ? "–" : ""}
                          value={locked ? "" : drafts[cellKey(index, row.side)] ?? ""}
                          onChange={(event) => type(index, row.side, event.target.value)}
                          onFocus={(event) => event.target.select()}
                          className={`h-12 w-full rounded-xl border text-center text-xl tabular-nums focus:outline-none focus-visible:border-[var(--v2-primary)] focus-visible:ring-2 focus-visible:ring-[var(--v2-primary)]/30 disabled:bg-[var(--v2-bg)] disabled:placeholder:text-[var(--v2-ink-2)] ${
                            setStatus(set) === "invalid" ? "border-[var(--v2-urgent)]" : "border-[var(--v2-border)]"
                          } ${cellTone(set, row.side)}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {sets[2]?.kind === "mtb" && format === "bo3" ? (
            <p className="mt-1 text-xs text-[var(--v2-ink-2)]">Match tiebreak: first to 10, win by 2.</p>
          ) : null}
        </div>
      )}

      <div className="mt-3 flex min-h-[24px] flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        {line ? (
          <p className="text-[15px] font-bold text-[var(--v2-success)]" aria-live="polite">{line}</p>
        ) : (
          <p className="text-sm text-[var(--v2-ink-2)]" aria-live="polite">{result.issue}</p>
        )}
        {dnf ? null : (
          <button
            type="button"
            onClick={() => {
              // Sets 2 and 3 start empty either way (LogResultPage changeFormat).
              setDrafts((current) => ({ "0-you": current["0-you"] ?? "", "0-opp": current["0-opp"] ?? "" }));
              onFormat(format === "single" ? "bo3" : "single");
            }}
            className="min-h-[44px] text-sm font-semibold text-[var(--v2-primary)]"
          >
            {format === "single" ? "Best of 3" : "Played one set?"}
          </button>
        )}
      </div>
    </div>
  );
}
