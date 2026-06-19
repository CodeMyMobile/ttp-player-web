import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";

import "./SignInSheet.css";

// Bottom sheet shown when a logged-out visitor taps any gated action on the
// profile (join / connect / sign in / report). No mutations — both CTAs route
// to the existing auth page. `actionLabel` tailors the heading to the action.
export interface SignInSheetProps {
  open: boolean;
  actionLabel: string;
  playerName: string;
  onClose: () => void;
}

const SignInSheet = ({ open, actionLabel, playerName, onClose }: SignInSheetProps) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const goToAuth = () => {
    onClose();
    navigate("/login");
  };

  const sheet = (
    <div
      className="sis-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={`Sign in to ${actionLabel}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sis-sheet">
        <div className="sis-grip" aria-hidden="true" />
        <div className="sis-ico" aria-hidden="true">
          <LogIn size={26} strokeWidth={2} />
        </div>
        <h2 className="sis-title">Sign in to {actionLabel}</h2>
        <p className="sis-sub">
          Create a free account or sign in to see full match times, join {playerName}&apos;s games,
          and connect with players near you.
        </p>
        <button type="button" className="sis-cta" onClick={goToAuth}>
          Create a free account
        </button>
        <button type="button" className="sis-ghost" onClick={goToAuth}>
          I already have an account
        </button>
        <button type="button" className="sis-dismiss" onClick={onClose}>
          Keep looking
        </button>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return sheet;
  }
  return createPortal(sheet, document.body);
};

export default SignInSheet;
