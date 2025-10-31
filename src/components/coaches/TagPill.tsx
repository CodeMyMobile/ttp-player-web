import type { ReactNode } from "react";

import "./coaches.css";

type TagPillProps = {
  children: ReactNode;
  tone?: "default" | "available" | "featured" | "accent";
  icon?: ReactNode;
};

const TagPill = ({ children, tone = "default", icon }: TagPillProps) => {
  return (
    <span className={`tag-pill tag-pill--${tone}`}>
      {icon && <span className="tag-pill__icon">{icon}</span>}
      <span className="tag-pill__label">{children}</span>
    </span>
  );
};

export default TagPill;
