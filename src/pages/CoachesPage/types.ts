import type { ReactNode } from "react";

export interface Coach {
  id: string | number;
  name: string;
  slug: string | number;
  avatarUrl?: string | null;
  rating?: number | null;
  reviewsCount?: number | null;
  hourlyRate?: number | null;
  hourlyRateDisplay?: string | null;
  distanceMiles?: number | null;
  locationName?: string | null;
  specialties: string[];
  bio?: string | null;
  isFeatured?: boolean;
  availability?: string | null;
}

export type SortOption = "recommended" | "highest-rated" | "lowest-rate" | "highest-rate";

export interface HeroStat {
  id: string;
  label: string;
  value: string;
  description?: string;
  icon?: ReactNode;
}
