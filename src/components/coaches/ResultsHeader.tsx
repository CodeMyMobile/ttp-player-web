import { MapPin } from "lucide-react";
import type { ReactNode } from "react";

import "./coaches.css";

type ResultsHeaderProps = {
  title: string;
  description: string;
  meta: string[];
  locationValue: string;
  onChangeLocation?: () => void;
  actionSlot?: ReactNode;
};

const ResultsHeader = ({
  title,
  description,
  meta,
  locationValue,
  onChangeLocation,
  actionSlot,
}: ResultsHeaderProps) => {
  return (
    <div className="results-header">
      <div className="results-header__text-group">
        <h1 className="results-header__title">{title}</h1>
        <p className="results-header__description">{description}</p>
        <div className="results-header__meta">
          {meta.map((item, index) => (
            <span key={item} className="results-header__meta-item">
              {item}
              {index < meta.length - 1 && <span className="results-header__meta-dot" />}
            </span>
          ))}
        </div>
      </div>
      <div className="results-header__actions">
        <button type="button" className="location-button" onClick={onChangeLocation}>
          <MapPin size={18} />
          <div className="location-button__meta">
            <span className="location-button__label">Location</span>
            <span className="location-button__value">{locationValue}</span>
          </div>
        </button>
        <button type="button" className="change-location" onClick={onChangeLocation}>
          Change location
        </button>
        {actionSlot}
      </div>
    </div>
  );
};

export default ResultsHeader;
