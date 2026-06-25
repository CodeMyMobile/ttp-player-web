// Small shared primitives for the Log a Result flow.
//
// The app has no generic Button/Avatar/Chip library (cards are feature-specific
// BEM components), so these stay local to the module — matching the inline-Tailwind
// precedent in src/components/booking/BookingStatusModal.tsx. Colours map to the
// brand tokens: violet-500 = #8B5CF6 (accentPurple), violet-600 = #7C3AED.
import type { ComponentType, ReactNode } from "react";
import { initials } from "./scoring";

interface AvatarProps {
  name: string;
  color?: string;
  size?: string;
  text?: string;
}

export function Avatar({ name, color = "bg-violet-100 text-violet-700", size = "h-10 w-10", text = "text-sm" }: AvatarProps) {
  return (
    <div className={`${size} ${color} rounded-full grid place-items-center font-semibold ${text} shrink-0`}>
      {initials(name)}
    </div>
  );
}

interface SectionLabelProps {
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}

export function SectionLabel({ icon: Icon, children }: SectionLabelProps) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
      <Icon className="h-3.5 w-3.5 text-violet-500" />
      {children}
    </label>
  );
}

interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function Chip({ active, onClick, children }: ChipProps) {
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

interface PointFieldProps {
  value: number;
  onChange: (value: number) => void;
  max?: number;
}

export function PointField({ value, onChange, max = 20 }: PointFieldProps) {
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

interface PrimaryButtonProps {
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}

export function PrimaryButton({ disabled, onClick, className = "", children }: PrimaryButtonProps) {
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
