import type { ReactNode } from "react";
import { Swords, Users } from "lucide-react";

import "./matchCardAtoms.css";

// Pure presentational atoms shared by the match cards so the look has one
// source and the live (OpenMatchPlayCard) and locked (LockedMatchCard) cards
// can't drift visually. Atoms only — no data shaping, no behavior. The live
// card keeps its own `.omp-*` styles for now and migrates to these later.

const isDoublesFormat = (format: string): boolean => /doubles|mixed/i.test(format);

export const MatchCardShell = ({
  clickable = false,
  className = "",
  children,
  ...rest
}: {
  clickable?: boolean;
  className?: string;
  children: ReactNode;
} & React.HTMLAttributes<HTMLElement>) => (
  <article
    className={`mca-card${clickable ? " mca-card--clickable" : ""}${className ? ` ${className}` : ""}`}
    {...rest}
  >
    {children}
  </article>
);

// Format icon + format name + level subtitle (left side of a card's top row).
export const MatchFormatBlock = ({
  format,
  levelLabel,
}: {
  format: string;
  levelLabel: string;
}) => (
  <div className="mca-format">
    <span className="mca-fico" aria-hidden="true">
      {isDoublesFormat(format) ? (
        <Users size={19} strokeWidth={2} />
      ) : (
        <Swords size={19} strokeWidth={2} />
      )}
    </span>
    <div>
      <div className="mca-fmt">{format}</div>
      <div className="mca-lvl">{levelLabel}</div>
    </div>
  </div>
);

// Spots-left chip (right side of a card's top row). `tight` = urgency styling at
// 1 spot; `muted` = informational (e.g. host/joined) with no urgency color.
export const MatchSpots = ({
  spotsLeft,
  joined,
  total,
  tight = false,
  muted = false,
}: {
  spotsLeft: number;
  joined: number;
  total: number | null;
  tight?: boolean;
  muted?: boolean;
}) => (
  <div className="mca-spots">
    <div
      className={`mca-spots-num${muted ? " mca-spots-num--muted" : tight ? " tight" : ""}`}
    >
      {spotsLeft <= 0 ? "Full" : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`}
    </div>
    {total ? (
      <div className="mca-spots-lbl">
        {joined} of {total}
      </div>
    ) : null}
  </div>
);
