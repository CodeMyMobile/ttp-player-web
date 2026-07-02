import React from "react";
import { AlertTriangle, Check, CheckCircle2, Clock, MapPin } from "lucide-react";
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
  matchId?: string | number | null;
  status?: string | null;
  onLogAnother: () => void;
}

const statusLabel = (status?: string | null) => {
  if (!status) return "Awaiting confirmation";
  if (status === "pending") return "Awaiting confirmation";
  return status.replace(/_/g, " ");
};

// Success state — shows the result exactly as it reads while awaiting confirmation.
export function SentCard({ me, opponent, date, court, sets, dnf, matchId, status, onLogAnother }: SentCardProps) {
  const score = scoreString(sets, dnf);
  const currentStatus = statusLabel(status);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center shadow-md shadow-slate-200/60 sm:px-6">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
          <Check className="h-8 w-8" strokeWidth={3} />
        </div>
        <h2 className="text-2xl font-semibold text-slate-900">Score submitted</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
          Great match. Your score has been sent to {opponent.name} for confirmation.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-1">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 py-3">
          <span className="text-xs font-medium text-slate-500">Opponent</span>
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={opponent.name} color={opponent.color} size="h-7 w-7" text="text-[11px]" />
            <span className="truncate text-sm font-semibold text-slate-900">{opponent.name}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 py-3">
          <span className="text-xs font-medium text-slate-500">Score</span>
          <span className="text-lg font-semibold tabular-nums text-violet-700">{score}</span>
        </div>
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 py-3">
          <span className="text-xs font-medium text-slate-500">Date</span>
          <span className="text-sm font-semibold text-slate-900">{prettyDate(date)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 py-3">
          <span className="text-xs font-medium text-slate-500">Location</span>
          <span className="flex min-w-0 items-center gap-1.5 text-right text-sm font-semibold text-slate-900">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-violet-500" />
            <span className="truncate">{court.name}</span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <span className="text-xs font-medium text-slate-500">Status</span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">
            {currentStatus}
          </span>
        </div>
        {matchId ? <p className="pb-3 text-right text-[11px] font-medium text-slate-400">Result #{matchId}</p> : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
        <h3 className="text-base font-semibold text-slate-900">What happens next</h3>
        <div className="mt-4 space-y-5">
          <TimelineItem icon="done" title="1. Opponent confirms (48 hours)">
            {opponent.name} will receive a notification to confirm or dispute your score. Most matches are confirmed within a few hours.
          </TimelineItem>
          <TimelineItem icon="pending" title="2. Score status: Awaiting confirmation">
            Your match appears as pending in both players' match history. Ratings are not updated yet.
          </TimelineItem>
          <TimelineItem icon="future" title="3. Ratings update">
            Once confirmed, both players' ratings, standings, and match records update.
          </TimelineItem>
          <TimelineItem icon="future" title="4. Match complete">
            The match appears in your results history and counts toward your record.
          </TimelineItem>
        </div>
      </section>

      <section className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <div>
            <p className="font-semibold">Remember: 48-hour window</p>
            <p className="mt-1 text-xs leading-5">
              If your opponent doesn't confirm or dispute within 48 hours, the score is automatically confirmed.
              Make sure the score format is correct to avoid disputes.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">What if there's a dispute?</p>
            <p className="mt-1 text-xs leading-5">
              If {opponent.name} disagrees with the score, both players can resolve it. The league admin can arbitrate if needed.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <PrimaryButton onClick={onLogAnother}>Log another result</PrimaryButton>
        <a
          href="#/matches"
          className="grid min-h-[48px] place-items-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          View pending matches
        </a>
      </div>
    </div>
  );
}

function TimelineItem({
  icon,
  title,
  children,
}: {
  icon: "done" | "pending" | "future";
  title: string;
  children: React.ReactNode;
}) {
  const dotClass = icon === "done"
    ? "bg-emerald-500 ring-emerald-100"
    : icon === "pending"
      ? "bg-amber-400 ring-amber-100"
      : "bg-slate-300 ring-slate-100";

  return (
    <div className="relative pl-9 before:absolute before:left-[11px] before:top-6 before:h-[calc(100%+8px)] before:w-px before:bg-slate-200 last:before:hidden">
      <span className={`absolute left-1 top-1 grid h-4 w-4 place-items-center rounded-full ring-4 ${dotClass}`}>
        {icon === "done" ? <CheckCircle2 className="h-3 w-3 text-white" strokeWidth={3} /> : null}
      </span>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{children}</p>
    </div>
  );
}
