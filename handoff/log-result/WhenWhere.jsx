import { useState } from "react";
import { CalendarDays, MapPin, Search, X } from "lucide-react";
import { SectionLabel, Chip } from "./ui";
import { TODAY, YESTERDAY } from "./scoring";

// Date defaults to today (Today/Yesterday shortcuts + native picker, capped at today).
// Court is REQUIRED — needed for location filtering in the rankings later.
export function WhenWhere({ date, onDateChange, court, onCourtChange, courts }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = courts.filter((c) => (c.name + c.area).toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <SectionLabel icon={CalendarDays}>When &amp; where</SectionLabel>

      <div className="flex items-center gap-2 flex-wrap">
        <Chip active={date === TODAY} onClick={() => onDateChange(TODAY)}>Today</Chip>
        <Chip active={date === YESTERDAY} onClick={() => onDateChange(YESTERDAY)}>Yesterday</Chip>
        <input type="date" max={TODAY} value={date} onChange={(e) => onDateChange(e.target.value || TODAY)} className="ml-auto rounded-lg border border-slate-200 px-2.5 py-2 text-base sm:text-sm font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40" />
      </div>

      <div className="mt-2.5">
        {court ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 grid place-items-center shrink-0 shadow-sm shadow-violet-600/30">
              <MapPin className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-900 truncate">{court.name}</div>
              <div className="text-xs text-slate-500">{court.area}</div>
            </div>
            <button onClick={() => onCourtChange(null)} className="grid h-8 w-8 place-items-center text-slate-300 hover:text-rose-500 transition-colors" aria-label="Change court"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <button onClick={() => setOpen((o) => !o)} className="w-full rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-3 flex items-center gap-2 text-sm font-semibold text-violet-600 hover:border-violet-400 hover:bg-violet-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40">
            <MapPin className="h-4 w-4 shrink-0" /> Choose a court
          </button>
        )}

        {open && !court && (
          <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
              <Search className="h-4 w-4 text-slate-400" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search courts" className="w-full text-base sm:text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none" />
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>
            <ul className="max-h-56 overflow-y-auto py-1">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button onClick={() => { onCourtChange(c); setOpen(false); setQuery(""); }} className="w-full flex items-center gap-3 px-3 py-3 hover:bg-violet-50/60 transition-colors text-left">
                    <div className="h-8 w-8 rounded-lg bg-violet-100 grid place-items-center shrink-0"><MapPin className="h-4 w-4 text-violet-600" /></div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.area}</div>
                    </div>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">No courts match “{query}”.</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
