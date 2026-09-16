import { ShieldCheck } from "lucide-react";
import type { GroupLessonLevel } from "../../api/groupLessons";
import { levelRequirementTitle } from "../../utils/groupLessonLevelRequirement";

interface LevelRequirementNoticeProps {
  /** Null on a class with no stated level — the notice does not render at all. */
  requirement: GroupLessonLevel | null;
  onOpenLevelCheck: () => void;
}

/**
 * The level a class asks for, stated before checkout rather than discovered on
 * court. Information, not a warning: purple rather than red, because the class is
 * still bookable and the coach makes the final call — which is what the body says.
 */
export function LevelRequirementNotice({ requirement, onOpenLevelCheck }: LevelRequirementNoticeProps) {
  if (requirement === null) return null;

  return (
    <div className="mt-3 flex gap-3 rounded-2xl border border-[#e9d7fe] bg-[#f9f5ff] px-4 py-3">
      <ShieldCheck className="mt-[2px] shrink-0 text-[#7c3aed]" size={18} aria-hidden="true" />
      <div className="text-left">
        <p className="m-0 text-[14px] font-extrabold text-[#53389e]">
          {levelRequirementTitle(requirement)}
        </p>
        <p className="m-0 mt-1 text-[13px] leading-[1.5] text-[#6941c6]">
          Placement is at the coach's discretion. Not sure of your level?{" "}
          <button
            type="button"
            onClick={onOpenLevelCheck}
            className="inline bg-transparent p-0 font-bold text-[#7c3aed] underline underline-offset-2"
          >
            Take the level check
          </button>
        </p>
      </div>
    </div>
  );
}
