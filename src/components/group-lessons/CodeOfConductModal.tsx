import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { marked } from "marked";
import codeOfConduct from "../../content/code-of-conduct.md?raw";

/**
 * The policy, rendered from the same markdown the public page is built from —
 * src/content/code-of-conduct.md, which scripts/build-legal.mjs prerenders to
 * /code-of-conduct/. One source, so the modal and the page cannot drift.
 *
 * The h1 is dropped: the modal has its own title bar, and two headings reading
 * "Player Code of Conduct" one above the other is worse than none.
 */
// Outbound links leave in a new tab so a reader following a citation does not lose
// the policy — and `noopener`, because target="_blank" otherwise hands the opened
// page a reference back to this one. Mirrored in scripts/build-legal.mjs, which
// renders this same markdown for /code-of-conduct/.
const html = (marked.parse(codeOfConduct.replace(/^#\s.*\n/, ""), { gfm: true }) as string).replace(
  /<a href="(https?:\/\/[^"]+)"/g,
  '<a href="$1" target="_blank" rel="noopener noreferrer"',
);

interface CodeOfConductModalProps {
  open: boolean;
  onClose: () => void;
}

export function CodeOfConductModal({ open, onClose }: CodeOfConductModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    // Focus moves in on open and the trap keeps it here, so a keyboard user
    // cannot tab into the checkout behind the dimmed backdrop.
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
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

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex items-stretch justify-center bg-white px-0 py-0 sm:items-center sm:bg-[rgba(15,23,42,0.55)] sm:px-4 sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="code-of-conduct-title"
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="flex min-h-screen w-full flex-col bg-white sm:max-h-[86vh] sm:min-h-0 sm:max-w-[560px] sm:rounded-2xl sm:shadow-[0_30px_60px_rgba(0,0,0,0.3)]"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="code-of-conduct-title" className="m-0 text-[17px] font-extrabold text-slate-900">
            Player Code of Conduct
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div
          className="coc-prose flex-1 overflow-y-auto px-5 py-5 text-[14px] leading-[1.6] text-slate-700"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <div className="border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-[#8b5cf6] px-4 py-3 text-[15px] font-bold text-white"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
