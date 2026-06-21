import { Check, MapPin, Info } from "lucide-react";
import { Avatar, PrimaryButton } from "./ui";
import { prettyDate, scoreString } from "./scoring";
import type { CurrentUser, Player, Court, MatchSet } from "./scoring";

interface SentCardProps {
  me: CurrentUser;
  opponent: Player;
  date: string;
  court: Court;
  sets: MatchSet[];
  dnf: boolean;
  onLogAnother: () => void;
}

// Success state — shows the result exactly as it reads while awaiting confirmation.
export function SentCard({ me, opponent, date, court, sets, dnf, onLogAnother }: SentCardProps) {
  return (
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
          <Avatar name={me.name} />
          <span className="text-base font-extrabold text-slate-900 tabular-nums">{scoreString(sets, dnf)}</span>
          <Avatar name={opponent.name} color={opponent.color} />
        </div>
        <div className="mt-2.5 flex items-center gap-3 text-xs font-medium text-slate-500">
          <span>{prettyDate(date)}</span>
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-violet-500" />{court.name}</span>
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-slate-500 border-t border-amber-200/70 pt-3">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
          No response within 48 hours and it’s confirmed automatically. {opponent.name} can dispute it in that window.
        </p>
      </div>

      <PrimaryButton onClick={onLogAnother} className="mt-5">Log another result</PrimaryButton>
    </div>
  );
}
