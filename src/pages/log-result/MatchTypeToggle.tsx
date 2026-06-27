import { Tag } from "lucide-react";
import { SectionLabel } from "./ui";

export type MatchType = "recreational" | "league";

interface MatchTypeToggleProps {
  value: MatchType;
  onChange: (value: MatchType) => void;
}

export function MatchTypeToggle({ value, onChange }: MatchTypeToggleProps) {
  return (
    <div>
      <SectionLabel icon={Tag}>Match type</SectionLabel>
      <div className="inline-flex rounded-full bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => onChange("recreational")}
          className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
            value === "recreational" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"
          }`}
        >
          Casual
        </button>
        <button
          type="button"
          onClick={() => onChange("league")}
          className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
            value === "league" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"
          }`}
        >
          League
        </button>
      </div>
    </div>
  );
}
