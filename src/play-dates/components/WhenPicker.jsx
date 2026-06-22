import React, { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { formatDayLabel, formatTimeLabel } from "../utils/matchTimeLabels";

const pad = (value) => String(value).padStart(2, "0");
const formatLocalDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const QUICK_TIMES = [
  "07:00",
  "09:00",
  "12:00",
  "16:00",
  "18:00",
  "19:00",
  "20:00",
];

const buildQuickDays = () => {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return {
      iso: formatLocalDate(d),
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
    };
  });
};

// Day + time picker sub-screen. Stores ISO date ("YYYY-MM-DD") + 24h time
// ("HH:mm") so the values feed combineDateAndTimeToIso (via buildMatchPayload)
// exactly like the legacy flow.
function WhenPicker({ initialDate = "", initialTime = "", onSave, onCancel }) {
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const quickDays = useMemo(buildQuickDays, []);

  const ready = Boolean(date && time);
  const summary = ready
    ? `${formatDayLabel(date)} at ${formatTimeLabel(time)}`
    : "Select a day and time";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-slate-100 px-5 pb-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-extrabold uppercase tracking-[0.08em] text-violet-700">
            Match · time
          </div>
          <div className="text-[23px] font-extrabold tracking-tight text-slate-900">
            When?
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
          Pick a day
        </div>
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {quickDays.map((d) => (
            <button
              key={d.iso}
              type="button"
              onClick={() => setDate(d.iso)}
              className={`flex-shrink-0 rounded-full border px-4 py-2 text-[13.5px] font-extrabold ${
                date === d.iso
                  ? "border-violet-500 bg-violet-500 text-white"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="mb-5 flex items-center gap-2.5">
          <span className="flex-shrink-0 text-[12.5px] font-bold text-slate-500">
            Or any date:
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-[15px] font-bold text-slate-900 outline-none focus:border-violet-500"
          />
        </div>

        <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
          Start time
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {QUICK_TIMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTime(t)}
              className={`rounded-full border px-4 py-2 text-[13.5px] font-extrabold ${
                time === t
                  ? "border-violet-500 bg-violet-500 text-white"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {formatTimeLabel(t)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          <span className="flex-shrink-0 text-[12.5px] font-bold text-slate-500">
            Or any time:
          </span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-[15px] font-bold text-slate-900 outline-none focus:border-violet-500"
          />
        </div>

        <div className="mt-4 rounded-xl bg-violet-50 px-3 py-3 text-center text-[13px] font-bold text-violet-700">
          {summary}
        </div>
      </div>

      <div className="flex flex-shrink-0 gap-2.5 border-t border-slate-100 px-5 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-[15px] font-extrabold text-slate-700"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => onSave(date, time)}
          className="flex-1 rounded-xl bg-violet-500 px-4 py-3.5 text-[15px] font-extrabold text-white shadow-lg shadow-violet-500/30 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
        >
          Set time
        </button>
      </div>
    </div>
  );
}

export default WhenPicker;
