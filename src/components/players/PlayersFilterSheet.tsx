import { useCallback, useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

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
};

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const PlayersFilterSheet = ({
  isOpen,
  draft,
  applied,
  defaults,
  groups,
  countForDraft,
  onDraftChange,
  onApply,
  onDismiss,
  onReset,
}: PlayersFilterSheetProps) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const handleDismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  // Focus in on open, focus back to the opener on close, and trapped in between.
  // The sheet covers the results, so focus escaping to them is both confusing and a
  // way to change filters that are no longer visible.
  useEffect(() => {
    if (!isOpen) return undefined;

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleDismiss();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      // No offsetParent/getClientRects check: those depend on layout, and everything
      // inside the panel is visible by construction. A layout-dependent filter here
      // silently empties the list — and an empty list means no trap at all.
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (node) => !node.hasAttribute("hidden") && node.getAttribute("aria-hidden") !== "true",
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      restoreFocusRef.current?.focus?.();
    };
  }, [isOpen, handleDismiss]);

  // Lock the body while the sheet is up, so the results do not scroll underneath it.
  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fp-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        className="fp-sheet__scrim"
        aria-label="Discard filter changes"
        onClick={handleDismiss}
      />

      <div className="fp-sheet__panel" ref={panelRef}>
        <div className="fp-sheet__head">
          <h2 className="fp-sheet__title" id={titleId}>
            Filters
          </h2>
          <button
            type="button"
            className="fp-sheet__close"
            aria-label="Close without applying"
            onClick={handleDismiss}
            ref={closeRef}
          >
            <X size={18} />
          </button>
        </div>

        <div className="fp-sheet__body">
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
        </div>

        <div className="fp-sheet__foot">
          <button type="button" className="fp-sheet__reset" onClick={onReset}>
            Reset to my defaults
          </button>
          <button type="button" className="fp-sheet__apply" onClick={onApply}>
            {/* Drops the number when a server-side filter changed — see applyLabel. */}
            {applyLabel(draft, applied, countForDraft)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayersFilterSheet;
export type { OptionGroup, PlayersFilterSheetProps };
