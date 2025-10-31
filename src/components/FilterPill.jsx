import { forwardRef } from "react";

const FilterPill = forwardRef(
  (
    {
      as: Component = "button",
      children,
      icon: Icon,
      onClick,
      selected = false,
      variant = "ghost",
      className = "",
      ...rest
    },
    ref
  ) => {
    const type = Component === "button" && !rest.type ? "button" : rest.type;

    return (
      <Component
        ref={ref}
        onClick={onClick}
        className={`filter-pill ${variant} ${selected ? "is-selected" : ""} ${className}`.trim()}
        type={type}
        {...rest}
      >
        {Icon ? <Icon size={16} strokeWidth={2} aria-hidden="true" /> : null}
        <span>{children}</span>
      </Component>
    );
  }
);

FilterPill.displayName = "FilterPill";

export default FilterPill;
