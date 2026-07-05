import { Tag } from "lucide-react";
import { SectionLabel } from "./ui";

// Casual only for now; League is shown but disabled (Phase 1.1).
export function MatchTypeToggle() {
  return (
    <div>
      <SectionLabel icon={Tag}>Match type</SectionLabel>
      <div className="inline-flex rounded-full bg-slate-100 p-1">
        <button className="rounded-full bg-white px-4 py-2 text-sm font-bold text-violet-700 shadow-sm">Casual</button>
        <button disabled className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-slate-400 cursor-not-allowed">
          League <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">Soon</span>
        </button>
      </div>
    </div>
  );
}
