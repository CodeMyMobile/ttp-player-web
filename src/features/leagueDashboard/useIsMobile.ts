// Tracks whether the viewport is at the mobile dashboard breakpoint (≤560px).
//
// The League Dashboard branches its ENTIRE rendered layout on this: desktop
// keeps the current JSX verbatim (pixel-identical), mobile gets the segmented
// section-nav structure. Initialized from window synchronously so there's no
// desktop→mobile flash on first paint.

import { useEffect, useState } from "react";

const QUERY = "(max-width: 560px)";

const readMatch = (): boolean =>
  typeof window !== "undefined" && window.innerWidth <= 560;

export const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState<boolean>(readMatch);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
};

export default useIsMobile;
