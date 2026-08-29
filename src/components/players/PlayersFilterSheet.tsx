import SheetShell from "./SheetShell";
import {
  applyLabel,
  type FilterKey,
  type PlayerFilterState,
} from "../../utils/playerFilters";

import "./players.css";

type OptionGroup = { key: FilterKey; label: string; options: string[] };

type PlayersFilterSheetProps = {
  isOpen: boolean;
  draft: PlayerFilterState;
  applied: PlayerFilterState;
  defaults: PlayerFilterState;
  groups: OptionGroup[];
  /** Result count the draft WOULD produce, over the already-loaded pool. */
  countForDraft: number;
  onDraftChange: (patch: Partial<PlayerFilterState>) => void;
  onApply: () => void;
  /** Discard the draft — scrim, Escape and the close button all land here. */
  onDismiss: () => void;
  onReset: () => void;
  /** Leaves the sheet and edits the viewer's own profile — a different class of
   *  action from narrowing a list, so it sits apart from the filter groups. */
  onEditProfile?: () => void;
};

/** Panel, scrim, focus trap, scroll lock and Escape all live in SheetShell. */
const PlayersFilterSheet = ({
  isOpen,
  draft,
  applied,
  groups,
  countForDraft,
  onDraftChange,
  onApply,
  onDismiss,
  onReset,
  onEditProfile,
}: PlayersFilterSheetProps) => (
  <SheetShell
    isOpen={isOpen}
    title="Filters"
    onDismiss={onDismiss}
    closeLabel="Close without applying"
    footer={
      <>
        <button type="button" className="fp-sheet__reset" onClick={onReset}>
          Reset to my defaults
        </button>
        <button type="button" className="fp-sheet__apply" onClick={onApply}>
          {/* Drops the number when a server-side filter changed — see applyLabel. */}
          {applyLabel(draft, applied, countForDraft)}
        </button>
      </>
    }
  >
    {groups.map((group) => (
      <fieldset className="fp-sheet__group" key={group.key}>
        <legend className="fp-sheet__legend">{group.label}</legend>
        <div className="fp-sheet__options">
          {group.options.map((option) => {
            const selected = String(draft[group.key]) === option;
            return (
              <button
                type="button"
                key={option}
                className={`fp-sheet__option${selected ? " is-selected" : ""}`}
                aria-pressed={selected}
                onClick={() => onDraftChange({ [group.key]: option } as Partial<PlayerFilterState>)}
              >
                {option}
              </button>
            );
          })}
        </div>
      </fieldset>
    ))}

    <div className="fp-sheet__group fp-sheet__group--switch">
      <label className="fp-sheet__switch">
        <input
          type="checkbox"
          checked={draft.verifiedOnly}
          onChange={(event) => onDraftChange({ verifiedOnly: event.target.checked })}
        />
        <span>Confirmed ratings only</span>
      </label>
    </div>

    {onEditProfile ? (
      // Below every filter group and outside the sticky footer: it changes the viewer's
      // own data rather than the list, and must not compete with Apply.
      <button type="button" className="fp-sheet__profile-link" onClick={onEditProfile}>
        Edit my match profile
        <span aria-hidden="true">&rarr;</span>
      </button>
    ) : null}
  </SheetShell>
);

export default PlayersFilterSheet;
export type { OptionGroup, PlayersFilterSheetProps };
