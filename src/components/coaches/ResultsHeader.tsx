import { MapPin, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import "./coaches.css";

type ResultsHeaderProps = {
  title: string;
  description: string;
  metaLine: string;
  locationValue: string;
  onChangeLocation?: () => void;
  actionSlot?: ReactNode;
};

const ResultsHeader = ({
  title,
  description,
  metaLine,
  locationValue,
  onChangeLocation,
  actionSlot,
}: ResultsHeaderProps) => {
  return (
    <header className="fc-header">
      <div className="fc-header__text">
        <h1 className="fc-header__title">{title}</h1>
        <p className="fc-header__description">{description}</p>
        <p className="fc-header__meta">{metaLine}</p>
      </div>
      <div className="fc-header__actions">
        <button type="button" className="fc-location-chip" onClick={onChangeLocation}>
          <MapPin size={18} />
          <span className="fc-location-chip__content">
            <span className="fc-location-chip__label">Current location</span>
            <span className="fc-location-chip__value">{locationValue}</span>
          </span>
        </button>
        <button type="button" className="fc-change-location" onClick={onChangeLocation}>
          <RefreshCw size={16} />
          Change location
        </button>
        {actionSlot}
      </div>
    </header>
  );
};

export default ResultsHeader;
