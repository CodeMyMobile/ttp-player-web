import { AlertTriangle, Inbox } from "lucide-react";
import type { ReactNode } from "react";

import "./coaches.css";

type StateBannerProps = {
  tone: "empty" | "error";
  title: string;
  message: string;
  action?: ReactNode;
};

const iconMap = {
  empty: Inbox,
  error: AlertTriangle,
};

const StateBanner = ({ tone, title, message, action }: StateBannerProps) => {
  const Icon = iconMap[tone];

  return (
    <div className={`state-banner state-banner--${tone}`}>
      <div className="state-banner__icon">
        <Icon size={24} />
      </div>
      <div className="state-banner__content">
        <h3 className="state-banner__title">{title}</h3>
        <p className="state-banner__message">{message}</p>
        {action}
      </div>
    </div>
  );
};

export default StateBanner;
