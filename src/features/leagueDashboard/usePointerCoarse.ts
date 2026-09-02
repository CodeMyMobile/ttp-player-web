// Whether the device has a coarse pointer — i.e. a touch screen that can
// actually service `sms:` and `tel:` links.
//
// Deliberately NOT useIsMobile: that asks "is the viewport narrow", which is a
// layout question. This asks "will a tel: link do anything", which is a
// capability question. They disagree in exactly the cases that matter — a
// narrow desktop window is not a phone, and an iPad in landscape is.

import { useEffect, useState } from "react";

const QUERY = "(pointer: coarse)";

const readMatch = (): boolean =>
  typeof window !== "undefined"
  && typeof window.matchMedia === "function"
  && window.matchMedia(QUERY).matches;

export const usePointerCoarse = (): boolean => {
  // Read synchronously so the first paint already offers the right affordance,
  // rather than flashing a dead link and then swapping it for a copy button.
  const [coarse, setCoarse] = useState<boolean>(readMatch);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(QUERY);
    const onChange = () => setCoarse(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return coarse;
};

export default usePointerCoarse;
