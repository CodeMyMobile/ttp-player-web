// Normalize a Google-Places-style location string to a clean, human venue label.
//
// Prod returns addresses like "{venue} {street}, {city}, {state} {zip}, USA". When a place has no
// street number, Google glues the city onto the venue with no comma — e.g.
// "Culver City High School Tennis Court Culver City, CA 90230, USA" — which is the doubled-city bug.
//
// Rule:
//  - take the text before the first comma;
//  - if it contains the GENERIC "Tennis Court(s)" keyword, keep the text before it (this also drops a
//    glued trailing city). Proper facility names ("Tennis Center", "Recreation Center", "Park", …) are
//    kept as-is;
//  - otherwise cut a trailing street address (the first " <digit>" run), keeping the venue name;
//  - a pure street address (no venue name) is returned unchanged — it IS the location.

const GENERIC_TENNIS_COURT = /\bTennis\s+Courts?\b/i;

export interface NormalizeVenueOptions {
  /**
   * Keep the generic "Tennis Court" suffix. Use on the surfaces that name the literal lesson location
   * (booking-slot locations, the "Where you'll play" list) where findability matters; omit on the
   * search card / profile header where a short venue name reads cleaner.
   */
  keepFacility?: boolean;
}

export const normalizeVenueLabel = (
  raw?: string | null,
  { keepFacility = false }: NormalizeVenueOptions = {},
): string => {
  if (!raw) return "";
  const head = String(raw).split(",")[0]?.trim() ?? "";
  if (!head) return "";

  const generic = GENERIC_TENNIS_COURT.exec(head);
  if (generic) {
    const before = head.slice(0, generic.index).trim();
    if (before) {
      return keepFacility ? `${before} ${generic[0]}`.replace(/\s+/g, " ").trim() : before;
    }
  }

  const street = /\s\d/.exec(head);
  if (street && head.slice(0, street.index).trim()) {
    return head.slice(0, street.index).trim();
  }

  return head;
};

export default normalizeVenueLabel;
