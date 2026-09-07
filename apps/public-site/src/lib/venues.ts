import venueData from "../data/venues.json" with { type: "json" };

export type Venue = {
  name: string;
  area: string;
};

export const VENUES: Record<string, Venue> = venueData;

export const areaLabel = (area: string) =>
  area
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
