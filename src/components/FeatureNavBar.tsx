import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";

import "./FeatureNavBar.css";

// Slim, native-feeling nav bar for a feature screen on phones: a back link with the parent's
// name, the screen title, and at most one icon action. Sticky, translucent, padded under the
// iOS status bar, with a hairline that appears only once the page has scrolled.
//
// It replaces the global AppNav on phones, so the screen hides AppNav itself at the same
// breakpoint (FEATURE_NAV_BREAKPOINT, where AppNav switches to its compact layout). On wider
// screens the bar hides itself unless `mobileOnly` is false.
//
//   <FeatureNavBar backLabel="Home" backTo="/" title="Restring" titleMode="on-scroll"
//                  action={<FeatureNavIconButton label="My orders" onClick={…}><ClipboardList /></FeatureNavIconButton>} />

export const FEATURE_NAV_BREAKPOINT = 820;

type FeatureNavBarProps = {
  title?: string;
  /** Parent screen's name, shown after the chevron ("‹ Home"). */
  backLabel?: string;
  /** Route to go back to; use onBack instead for in-screen navigation. */
  backTo?: string;
  onBack?: () => void;
  /** One icon action on the right, e.g. a FeatureNavIconButton. */
  action?: ReactNode;
  /** "on-scroll" hides the title until the page's own large title has scrolled away. */
  titleMode?: "always" | "on-scroll";
  /** Scroll distance (px) after which an on-scroll title appears. */
  titleRevealOffset?: number;
  mobileOnly?: boolean;
  className?: string;
};

function useScrollY() {
  const [scrollY, setScrollY] = useState(() => (typeof window === "undefined" ? 0 : window.scrollY));
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return scrollY;
}

export function FeatureNavIconButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button type="button" className="fnb__icon-btn" aria-label={label} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

const FeatureNavBar = ({
  title = "",
  backLabel = "Back",
  backTo,
  onBack,
  action = null,
  titleMode = "always",
  titleRevealOffset = 44,
  mobileOnly = true,
  className = "",
}: FeatureNavBarProps) => {
  const scrollY = useScrollY();
  const scrolled = scrollY > 0;
  const showTitle = titleMode === "always" || scrollY > titleRevealOffset;

  const backContent = (
    <>
      <ChevronLeft size={26} strokeWidth={2.4} aria-hidden="true" />
      <span>{backLabel}</span>
    </>
  );

  return (
    <header
      className={`fnb${mobileOnly ? " fnb--mobile-only" : ""}${scrolled ? " is-scrolled" : ""}${className ? ` ${className}` : ""}`}
    >
      <div className="fnb__inner">
        <div className="fnb__side">
          {backTo ? (
            <Link className="fnb__back" to={backTo}>{backContent}</Link>
          ) : onBack ? (
            <button type="button" className="fnb__back" onClick={onBack}>{backContent}</button>
          ) : null}
        </div>
        <h1 className={`fnb__title${showTitle ? "" : " is-hidden"}`} aria-hidden={showTitle ? undefined : true}>
          {title}
        </h1>
        <div className="fnb__side fnb__side--end">{action}</div>
      </div>
    </header>
  );
};

export default FeatureNavBar;
