import { useState } from "react";
import { Users, Plus, ChevronDown, Search, X } from "lucide-react";
import { Avatar, SectionLabel } from "./ui";
import type { CurrentUser, Player } from "./scoring";

interface PlayerPickerProps {
  me: CurrentUser;
  players: Player[];
  playersLoading?: boolean;
  playersError?: string | null;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  value: Player | null;
  onChange: (player: Player) => void;
}

// You vs Opponent. Opponent is chosen from registered players only — no free text.
export function PlayerPicker({
  me,
  players,
  playersLoading = false,
  playersError = null,
  searchQuery,
  onSearchChange,
  value,
  onChange,
}: PlayerPickerProps) {
  const [open, setOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState("");
  const query = searchQuery ?? localQuery;
  const filtered = onSearchChange
    ? players
    : players.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  const updateQuery = (nextQuery: string) => {
    setLocalQuery(nextQuery);
    onSearchChange?.(nextQuery);
  };

  return (
    <div>
      <SectionLabel icon={Users}>Players</SectionLabel>
      <div className="flex items-stretch gap-2.5">
        <div className="flex-1 rounded-xl border border-violet-200 bg-violet-50 p-3 flex items-center gap-2.5 min-w-0">
          <Avatar name={me.name} size="h-9 w-9" />
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 truncate">{me.name}</div>
            <div className="text-[11px] font-semibold text-violet-600">You</div>
          </div>
        </div>

        <div className="grid place-items-center text-xs font-bold text-slate-400 px-0.5">vs</div>

        <div className="flex-1 min-w-0">
          {value ? (
            <button onClick={() => setOpen((o) => !o)} className="w-full h-full rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-2.5 text-left hover:border-violet-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 min-w-0">
              <Avatar name={value.name} color={value.color} size="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900 truncate">{value.name}</div>
                <div className="text-[11px] text-slate-500">NTRP {value.ntrp}</div>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
            </button>
          ) : (
            <button onClick={() => setOpen((o) => !o)} className="w-full h-full min-h-[60px] rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/40 px-3 flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:border-violet-400 hover:bg-violet-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40">
              <Plus className="h-4 w-4 shrink-0" /> Choose player
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
            <Search className="h-4 w-4 text-slate-400" />
            <input autoFocus value={query} onChange={(e) => updateQuery(e.target.value)} placeholder="Search players" className="w-full text-base sm:text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none" />
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {playersLoading && <li className="px-3 py-6 text-center text-sm text-slate-400">Loading players…</li>}
            {!playersLoading && playersError && <li className="px-3 py-6 text-center text-sm text-rose-500">{playersError}</li>}
            {!playersLoading && !playersError && filtered.map((p) => (
              <li key={p.id}>
                <button onClick={() => { onChange(p); setOpen(false); updateQuery(""); }} className="w-full flex items-center gap-3 px-3 py-3 hover:bg-violet-50/60 transition-colors text-left">
                  <Avatar name={p.name} color={p.color} size="h-9 w-9" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{p.name}</div>
                    <div className="text-xs text-slate-500">NTRP {p.ntrp}</div>
                  </div>
                </button>
              </li>
            ))}
            {!playersLoading && !playersError && filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">No players match “{query}”.</li>}
          </ul>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-400">Only players already on The Tennis Plan can be picked.</p>
    </div>
  );
}
