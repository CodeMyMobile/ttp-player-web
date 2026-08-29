import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

import "./players.css";

/**
 * The bottom-sheet shell: panel, scrim, focus trap, scroll lock, Escape and focus
 * restore. Every sheet on this page is built on it.
 *
 * Extracted at the third sheet rather than the fourth, deliberately. Hand-rolling the
 * behaviour each time is how one of them ends up without a focus trap — which is
 * exactly the state LeagueJoinReviewSheet is in today: it has focus-on-open, Escape and
 * focus-restore, and neither a trap nor a scroll lock.
 *
 * Local to this feature on purpose. It is not a design-system component and should not
 * become one by accident; if another feature wants a sheet, that is a decision to take
 * deliberately rather than by import.
 */

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export type SheetShellProps = {
  isOpen: boolean;
  title: string;
  /** Every dismissal route lands here: scrim, Escape, and the close button. */
  onDismiss: () => void;
  children: ReactNode;
  /** Sticky footer, e.g. an Apply bar or a single call to action. */
  footer?: ReactNode;
  /** Accessible label for the close control, where "close" alone is ambiguous. */
  closeLabel?: string;
  className?: string;
};

const SheetShell = ({
  isOpen,
  title,
  onDismiss,
  children,
  footer,
  closeLabel = "Close",
  className,
}: SheetShellProps) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const dismiss = useCallback(() => onDismiss(), [onDismiss]);

  // Focus in on open, back to the opener on close, trapped in between. The sheet covers
  // the page, so focus escaping to it is both confusing and a way to operate controls
  // that are no longer visible.
  useEffect(() => {
    if (!isOpen) return undefined;

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      // No offsetParent or getClientRects check: those depend on layout, and when
      // layout is absent the filter empties the list and the trap silently does
      // nothing. Everything inside the panel is visible by construction.
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
  }, [isOpen, dismiss]);

  // Lock the body while the sheet is up, so the page does not scroll underneath it.
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
      <button type="button" className="fp-sheet__scrim" aria-label={closeLabel} onClick={dismiss} />

      <div className={`fp-sheet__panel${className ? ` ${className}` : ""}`} ref={panelRef}>
        <div className="fp-sheet__head">
          <h2 className="fp-sheet__title" id={titleId}>
            {title}
          </h2>
          <button
            type="button"
            className="fp-sheet__close"
            aria-label={closeLabel}
            onClick={dismiss}
            ref={closeRef}
          >
            <X size={18} />
          </button>
        </div>

        <div className="fp-sheet__body">{children}</div>

        {footer ? <div className="fp-sheet__foot">{footer}</div> : null}
      </div>
    </div>
  );
};

export default SheetShell;
