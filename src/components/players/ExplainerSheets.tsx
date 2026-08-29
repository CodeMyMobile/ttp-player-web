import { Check } from "lucide-react";

import SheetShell from "./SheetShell";

import "./players.css";

/**
 * The two explainers. Both are built on SheetShell, so they inherit the focus trap,
 * scroll lock, Escape and focus restore rather than reimplementing them.
 */

/* --------------------------------------------------- A. what the tick means */

export type TickExplainerProps = {
  isOpen: boolean;
  onDismiss: () => void;
  onConfirmMyLevel: () => void;
};

/**
 * TWO tiers, not three.
 *
 * The prototype described a third rung — a rating derived from results — that does not
 * exist on this payload: the players endpoint returns only isLevelConfirmed and a
 * verification count. An explainer describing a rung nobody can have is worse than no
 * explainer, so it is written for what the data can actually distinguish.
 */
export const TickExplainerSheet = ({ isOpen, onDismiss, onConfirmMyLevel }: TickExplainerProps) => (
  <SheetShell
    isOpen={isOpen}
    title="What the ✓ means"
    onDismiss={onDismiss}
    footer={
      <button type="button" className="fp-sheet__apply" onClick={onConfirmMyLevel}>
        Get my own level confirmed
      </button>
    }
  >
    <div className="fp-explain__entry">
      <span className="fp-explain__mark fp-explain__mark--tick" aria-hidden="true">
        <Check size={13} strokeWidth={3} />
      </span>
      <div>
        <h3 className="fp-explain__heading">Confirmed by players</h3>
        <p className="fp-explain__body">
          They set their own level, and players who&rsquo;ve actually hit with them agreed it was
          right. It takes three or more people who have played them.
        </p>
      </div>
    </div>

    <div className="fp-explain__entry">
      <span className="fp-explain__mark" aria-hidden="true" />
      <div>
        <h3 className="fp-explain__heading">Self-rated</h3>
        <p className="fp-explain__body">
          They told us their level and nobody has checked it. Often accurate — sometimes
          optimistic, in both directions.
        </p>
      </div>
    </div>

    <p className="fp-explain__caveat">
      A ✓ says a level has been checked, not that it&rsquo;s guaranteed. It says nothing about who
      someone is — we don&rsquo;t verify identity.
    </p>
  </SheetShell>
);

/* ------------------------------------------------------- B. how we choose */

export type ChoosingExplainerProps = {
  isOpen: boolean;
  onDismiss: () => void;
  onEditFilters: () => void;
};

/**
 * The four factors are listed in the SAME ORDER as the stamp's basis line. If the two
 * ever disagree, the page contradicts itself about how it works — which costs more than
 * either sentence is worth.
 */
export const ChoosingExplainerSheet = ({
  isOpen,
  onDismiss,
  onEditFilters,
}: ChoosingExplainerProps) => (
  <SheetShell
    isOpen={isOpen}
    title="How The Tennis Plan chooses"
    onDismiss={onDismiss}
    footer={
      <button type="button" className="fp-sheet__apply" onClick={onEditFilters}>
        Edit what I&rsquo;m looking for
      </button>
    }
  >
    <ol className="fp-explain__factors">
      <li>
        <strong>Shared courts.</strong> Two players who use the same court will actually meet.
        Everything else is a preference.
      </li>
      <li>
        <strong>Overlapping times.</strong> Both free on weekday mornings will find a court; two
        people who never are, won&rsquo;t.
      </li>
      <li>
        <strong>Closeness of level.</strong> Nearer your level comes first, tapering off as the gap
        widens.
      </li>
      <li>
        <strong>A confirmed rating breaks ties.</strong> It does not outrank a shared court.
      </li>
    </ol>

    <p className="fp-explain__caveat">
      Change any filter and we rank the same way, but the recommendation mark comes off — at that
      point you&rsquo;ve told us what you want, and our job is to find it rather than suggest it.
    </p>
  </SheetShell>
);
