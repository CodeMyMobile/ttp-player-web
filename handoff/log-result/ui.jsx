// Small shared primitives. TODO(Paul/Sahil): where the app already has equivalent
// design-system components (Button, Avatar, etc.), swap these for those — keep the
// visual result identical.
import { initials } from "./scoring";

export function Avatar({ name, color = "bg-violet-100 text-violet-700", size = "h-10 w-10", text = "text-sm" }) {
  return (
    <div className={`${size} ${color} rounded-full grid place-items-center font-semibold ${text} shrink-0`}>
      {initials(name)}
    </div>
  );
}

export function SectionLabel({ icon: Icon, children }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
      <Icon className="h-3.5 w-3.5 text-violet-500" />
      {children}
    </label>
  );
}

export function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
        active ? "bg-violet-600 text-white shadow-sm shadow-violet-600/30" : "bg-slate-100 text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

export function PointField({ value, onChange, max = 20 }) {
  return (
    <input
      inputMode="numeric"
      value={value}
      onChange={(e) => {
        const d = e.target.value.replace(/\D/g, "").slice(0, 2);
        onChange(d === "" ? 0 : Math.min(max, Number(d)));
      }}
      className="w-12 text-center text-base sm:text-sm font-bold tabular-nums text-slate-900 rounded-lg border border-slate-200 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
    />
  );
}

export function PrimaryButton({ disabled, onClick, className = "", children }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-xl py-3.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 ${
        disabled
          ? "bg-slate-200 text-slate-400 cursor-not-allowed"
          : "bg-gradient-to-b from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-600/30 hover:from-violet-600 hover:to-violet-700 active:scale-[0.99]"
      } ${className}`}
    >
      {children}
    </button>
  );
}
