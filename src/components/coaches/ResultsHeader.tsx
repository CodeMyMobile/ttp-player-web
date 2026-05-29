import type { ReactNode } from "react";

import "./coaches.css";

type ResultsHeaderProps = {
  title: string;
  description: string;
  mobileDescription?: string;
  actionSlot?: ReactNode;
};

const ResultsHeader = ({
  title,
  description,
  mobileDescription,
  actionSlot,
}: ResultsHeaderProps) => {
  return (
    <header className="fc-header">
      <div className="fc-header__text">
        <h1 className="fc-header__title">{title}</h1>
        <p className="fc-header__description">{description}</p>
        {mobileDescription ? (
          <p className="fc-header__description fc-header__description--mobile">{mobileDescription}</p>
        ) : null}
      </div>
      {actionSlot && <div className="fc-header__actions">{actionSlot}</div>}
    </header>
  );
};

export default ResultsHeader;
