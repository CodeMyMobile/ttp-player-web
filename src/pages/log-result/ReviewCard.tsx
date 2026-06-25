import { MapPin, Info } from "lucide-react";
import { Avatar } from "./ui";
import { ReadBoard, ResultPill } from "./Scoreboard";
import { prettyDate } from "./scoring";
import type { CurrentUser, Player, Court, Format, MatchSet, Result } from "./scoring";

interface ReviewCardProps {
  me: CurrentUser;
  opponent: Player;
  date: string;
  court: Court;
  format: Format;
  sets: MatchSet[];
  dnf: boolean;
  result: Result;
}

// The confirm step — what the opponent will be asked to verify.
export function ReviewCard({ me, opponent, date, court, format, sets, dnf, result }: ReviewCardProps) {
  const winnerName = result.winner === "you" ? me.name : opponent.name;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-md shadow-slate-200/60 space-y-5">
      <p className="text-center text-sm text-slate-500">Check this is right — it’s what {opponent.name} will be asked to confirm.</p>

      <div className="flex items-center justify-center gap-5">
        <div className="flex flex-col items-center gap-1.5"><Avatar name={me.name} size="h-14 w-14" text="text-base" /><span className="text-xs font-semibold text-slate-700">{me.name}</span></div>
        <span className="text-sm font-bold text-slate-300">vs</span>
        <div className="flex flex-col items-center gap-1.5"><Avatar name={opponent.name} color={opponent.color} size="h-14 w-14" text="text-base" /><span className="text-xs font-semibold text-slate-700">{opponent.name}</span></div>
      </div>

      {dnf ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
          <span className="text-sm font-semibold text-slate-900">{winnerName} won</span>
          <p className="mt-0.5 text-xs text-slate-400">Retirement / walkover · no margin bonus</p>
        </div>
      ) : (
        <ReadBoard me={me} opponent={opponent} sets={sets} format={format} result={result} />
      )}

      <div className="flex justify-center"><ResultPill me={me} opponent={opponent} result={result} dnf={dnf} /></div>

      <div className="flex items-center justify-center gap-3 text-sm text-slate-500 border-t border-slate-100 pt-4">
        <span className="font-semibold text-slate-700">{prettyDate(date)}</span>
        <span className="text-slate-300">·</span>
        <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-violet-500" />{court.name}</span>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs leading-relaxed text-amber-800">
        <Info className="h-4 w-4 mt-px shrink-0 text-amber-500" />
        {opponent.name} gets a text to confirm. No reply within 48 hours and it’s confirmed automatically — they can dispute it in that window.
      </div>
    </div>
  );
}
