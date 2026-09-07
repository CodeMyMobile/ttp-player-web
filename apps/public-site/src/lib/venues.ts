import venueData from "../data/venues.json" with { type: "json" };

export type Venue = {
  name: string;
  area: string;
};

export const VENUES: Record<string, Venue> = venueData;

export const normalizeVenueLabel = (raw: string) => {
  const head = raw.split(",")[0]?.trim() ?? "";
  const genericCourt = /\bTennis\s+Courts?\b/i.exec(head);
  if (genericCourt) return head.slice(0, genericCourt.index).trim();
  const street = /\s\d/.exec(head);
  return street ? head.slice(0, street.index).trim() : head;
};

export const areaLabel = (area: string) =>
  area
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
