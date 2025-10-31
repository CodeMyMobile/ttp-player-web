import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarCheck, DollarSign, Loader2, Star, Users2 } from "lucide-react";
import HeroStats from "./components/HeroStats";
import FiltersBar from "./components/FiltersBar";
import FilterChips from "./components/FilterChips";
import FeaturedCoachCard from "./components/FeaturedCoachCard";
import CoachCard from "./components/CoachCard";
import type { Coach, HeroStat, SortOption } from "./types";
import { getPlayerCoaches } from "../../api/playerHome";
import "./CoachesPage.css";

const ALL_LOCATIONS = "All Locations";

type RawCoach = Record<string, unknown>;

type PaginatedResponse<T> = {
  data?: T[];
  results?: T[];
  coaches?: T[];
  items?: T[];
  total?: number;
  meta?: Record<string, unknown>;
};

const parseNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.\-]/g, "");
    const parsed = Number.parseFloat(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const parseStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : String(item ?? "")))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/,|\n|\|/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const firstOf = (value: unknown): string | null => {
  if (!value) return null;
  if (Array.isArray(value)) {
    const firstNonEmpty = value
      .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "")))
      .find((item) => Boolean(item));
    return firstNonEmpty ?? null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  return null;
};

const normalizeCoach = (coach: RawCoach): Coach | null => {
  if (!coach) return null;
  const id =
    coach.id ??
    coach.coach_id ??
    coach.player_coach_id ??
    coach.user_id ??
    coach.uuid ??
    null;
  if (id === null || id === undefined) return null;

  const firstName = coach.first_name ?? coach.firstName ?? "";
  const lastName = coach.last_name ?? coach.lastName ?? "";
  const name =
    (typeof coach.name === "string" && coach.name.trim()) ||
    (typeof coach.full_name === "string" && coach.full_name.trim()) ||
    (typeof coach.fullName === "string" && coach.fullName.trim()) ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    "Coach";

  const slug = coach.slug ?? coach.username ?? id;

  const avatarUrl =
    coach.avatar ??
    coach.profile_image ??
    coach.profile_image_url ??
    coach.profilePhoto ??
    coach.photo ??
    null;

  const rating =
    parseNumber(coach.avg_rating) ??
    parseNumber(coach.average_rating) ??
    parseNumber(coach.rating) ??
    parseNumber(coach.rating_value);

  const reviewsCount =
    parseNumber(coach.reviews_count)?.valueOf() ??
    parseNumber(coach.review_count)?.valueOf() ??
    parseNumber(coach.reviews)?.valueOf() ??
    null;

  const hourlyRateRaw =
    parseNumber(coach.hourly_rate) ??
    parseNumber(coach.rate) ??
    parseNumber(coach.hourlyRate) ??
    parseNumber(coach.price_per_hour) ??
    parseNumber(coach.hourly_price);

  const hourlyRateDisplay =
    (typeof coach.hourly_rate_display === "string" && coach.hourly_rate_display) ??
    (typeof coach.hourly_rate_label === "string" && coach.hourly_rate_label) ??
    (typeof coach.rate_display === "string" && coach.rate_display) ??
    (hourlyRateRaw !== null ? `$${Math.round(hourlyRateRaw)}/hr` : null);

  const distanceMiles =
    parseNumber(coach.distance) ??
    parseNumber(coach.distance_in_miles) ??
    parseNumber(coach.distanceMiles) ??
    null;

  const locationName =
    firstOf(coach.primary_location) ??
    firstOf(coach.locationName) ??
    firstOf(coach.location) ??
    firstOf(coach.locations) ??
    firstOf(coach.location_list) ??
    firstOf(coach.location_names) ??
    firstOf(coach.city) ??
    null;

  const specialties = (() => {
    const tagSources = [
      coach.specialties,
      coach.coach_specialties,
      coach.tags,
      coach.skills,
      coach.focus_areas,
      coach.expertise,
    ];
    for (const source of tagSources) {
      const parsed = parseStringArray(source);
      if (parsed.length) return parsed;
    }
    return [];
  })();

  const bio =
    (typeof coach.bio === "string" && coach.bio) ??
    (typeof coach.short_bio === "string" && coach.short_bio) ??
    (typeof coach.description === "string" && coach.description) ??
    (typeof coach.about === "string" && coach.about) ??
    null;

  const isFeatured = Boolean(
    coach.is_featured ?? coach.featured ?? coach.featured_coach ?? coach.isFeatured,
  );

  const availability =
    (typeof coach.next_availability === "string" && coach.next_availability) ??
    (typeof coach.nextAvailability === "string" && coach.nextAvailability) ??
    (typeof coach.availability === "string" && coach.availability) ??
    null;

  return {
    id,
    name,
    slug,
    avatarUrl: typeof avatarUrl === "string" ? avatarUrl : null,
    rating,
    reviewsCount: reviewsCount ?? undefined,
    hourlyRate: hourlyRateRaw ?? undefined,
    hourlyRateDisplay,
    distanceMiles: distanceMiles ?? undefined,
    locationName: locationName ?? undefined,
    specialties,
    bio,
    isFeatured,
    availability,
  };
};

const extractCoaches = (response: PaginatedResponse<RawCoach> | RawCoach[] | undefined) => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.results)) return response.results;
  if (Array.isArray(response.coaches)) return response.coaches;
  if (Array.isArray(response.items)) return response.items;
  return [];
};

const sortCoaches = (coaches: Coach[], option: SortOption): Coach[] => {
  const withFallback = [...coaches];
  switch (option) {
    case "highest-rated":
      return withFallback.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case "lowest-rate":
      return withFallback.sort((a, b) => (a.hourlyRate ?? Number.POSITIVE_INFINITY) - (b.hourlyRate ?? Number.POSITIVE_INFINITY));
    case "highest-rate":
      return withFallback.sort((a, b) => (b.hourlyRate ?? 0) - (a.hourlyRate ?? 0));
    case "recommended":
    default:
      return withFallback.sort((a, b) => {
        const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0);
        if (ratingDiff !== 0) return ratingDiff;
        const reviewsDiff = (b.reviewsCount ?? 0) - (a.reviewsCount ?? 0);
        if (reviewsDiff !== 0) return reviewsDiff;
        return String(a.name).localeCompare(String(b.name));
      });
  }
};

const CoachesPage = () => {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(ALL_LOCATIONS);
  const [sortOption, setSortOption] = useState<SortOption>("recommended");
  const [activeSpecialties, setActiveSpecialties] = useState<string[]>([]);
  const [isFilterModalOpen, setFilterModalOpen] = useState(false);
  const [pendingSpecialties, setPendingSpecialties] = useState<string[]>([]);

  const fetchCoaches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getPlayerCoaches({ perPage: 60, page: 1 });
      const rawCoaches = extractCoaches(response as PaginatedResponse<RawCoach>);
      const normalized = rawCoaches
        .map((item) => normalizeCoach(item))
        .filter((item): item is Coach => Boolean(item));
      setCoaches(normalized);
    } catch (fetchError) {
      console.error("Failed to load coaches", fetchError);
      setError(fetchError instanceof Error ? fetchError.message : "Unable to load coaches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoaches();
  }, [fetchCoaches]);

  const locationOptions = useMemo(() => {
    const unique = new Set<string>([ALL_LOCATIONS]);
    coaches.forEach((coach) => {
      if (coach.locationName) {
        unique.add(coach.locationName);
      }
    });
    return Array.from(unique);
  }, [coaches]);

  useEffect(() => {
    if (!locationOptions.includes(selectedLocation)) {
      setSelectedLocation(locationOptions[0] ?? ALL_LOCATIONS);
    }
  }, [locationOptions, selectedLocation]);

  const specialtyOptions = useMemo(() => {
    const unique = new Set<string>();
    coaches.forEach((coach) => {
      coach.specialties.forEach((specialty) => unique.add(specialty));
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [coaches]);

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string }[] = [];
    if (selectedLocation !== ALL_LOCATIONS) {
      chips.push({ key: "location", label: `Location • ${selectedLocation}` });
    }
    if (searchTerm.trim()) {
      chips.push({ key: "search", label: `Search • ${searchTerm.trim()}` });
    }
    activeSpecialties.forEach((specialty) => {
      chips.push({ key: `specialty:${specialty}`, label: specialty });
    });
    return chips;
  }, [activeSpecialties, searchTerm, selectedLocation]);

  const filteredCoaches = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return sortCoaches(
      coaches.filter((coach) => {
        if (selectedLocation !== ALL_LOCATIONS && coach.locationName !== selectedLocation) {
          return false;
        }
        if (normalizedSearch) {
          const matchesName = coach.name.toLowerCase().includes(normalizedSearch);
          const matchesSpecialty = coach.specialties.some((specialty) =>
            specialty.toLowerCase().includes(normalizedSearch),
          );
          if (!matchesName && !matchesSpecialty) {
            return false;
          }
        }
        if (activeSpecialties.length) {
          const hasAll = activeSpecialties.every((specialty) =>
            coach.specialties.some((coachSpecialty) => coachSpecialty.toLowerCase() === specialty.toLowerCase()),
          );
          if (!hasAll) return false;
        }
        return true;
      }),
      sortOption,
    );
  }, [activeSpecialties, coaches, searchTerm, selectedLocation, sortOption]);

  const featuredCoaches = useMemo(() => {
    if (!filteredCoaches.length) return [];
    const explicitFeatured = filteredCoaches.filter((coach) => coach.isFeatured);
    const source = explicitFeatured.length ? explicitFeatured : filteredCoaches;
    return source
      .slice()
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 2);
  }, [filteredCoaches]);

  const featuredIds = useMemo(() => new Set(featuredCoaches.map((coach) => coach.id)), [featuredCoaches]);

  const remainingCoaches = useMemo(
    () => filteredCoaches.filter((coach) => !featuredIds.has(coach.id)),
    [filteredCoaches, featuredIds],
  );

  const heroStats = useMemo<HeroStat[]>(() => {
    if (!coaches.length) return [];
    const stats: HeroStat[] = [];
    stats.push({
      id: "total-coaches",
      label: "Available Coaches",
      value: String(coaches.length),
      icon: <Users2 size={24} />,
    });

    const ratings = coaches.map((coach) => coach.rating).filter((value): value is number => value !== null && value !== undefined);
    if (ratings.length) {
      const averageRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
      const totalReviews = coaches.reduce((sum, coach) => sum + (coach.reviewsCount ?? 0), 0);
      stats.push({
        id: "average-rating",
        label: "Average Rating",
        value: averageRating.toFixed(1),
        description: totalReviews ? `Based on ${totalReviews} reviews` : undefined,
        icon: <Star size={24} />,
      });
    }

    const rates = coaches
      .map((coach) => coach.hourlyRate)
      .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
    if (rates.length) {
      const averageRate = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
      stats.push({
        id: "average-rate",
        label: "Avg Hourly Rate",
        value: `$${Math.round(averageRate)}`,
        icon: <DollarSign size={24} />,
      });
    }

    stats.push({
      id: "lessons-booked",
      label: "Lessons Booked",
      value: "500+",
      description: "Players matched in the last year",
      icon: <CalendarCheck size={24} />,
      // TODO: replace with lessons booked metric from the API once available
    });

    return stats;
  }, [coaches]);

  const handleRemoveChip = useCallback(
    (key: string) => {
      if (key === "search") {
        setSearchTerm("");
        return;
      }
      if (key === "location") {
        setSelectedLocation(ALL_LOCATIONS);
        return;
      }
      if (key.startsWith("specialty:")) {
        const specialty = key.replace("specialty:", "");
        setActiveSpecialties((prev) => prev.filter((item) => item !== specialty));
      }
    },
    [],
  );

  const handleClearAll = useCallback(() => {
    setSearchTerm("");
    setSelectedLocation(ALL_LOCATIONS);
    setActiveSpecialties([]);
  }, []);

  const handleOpenFilters = useCallback(() => {
    setPendingSpecialties(activeSpecialties);
    setFilterModalOpen(true);
  }, [activeSpecialties]);

  const handleCloseFilters = useCallback(() => {
    setFilterModalOpen(false);
  }, []);

  const handleApplyFilters = useCallback(() => {
    setActiveSpecialties(pendingSpecialties);
    setFilterModalOpen(false);
  }, [pendingSpecialties]);

  const handleTogglePendingSpecialty = useCallback((specialty: string) => {
    setPendingSpecialties((prev) => {
      if (prev.includes(specialty)) {
        return prev.filter((item) => item !== specialty);
      }
      return [...prev, specialty];
    });
  }, []);

  const hasActiveFilters = activeSpecialties.length > 0;

  return (
    <main className="coaches-page">
      <HeroStats stats={heroStats} loading={loading && !coaches.length} />

      <section className="coaches-page__controls" aria-label="Search and filter">
        <FiltersBar
          locations={locationOptions}
          selectedLocation={selectedLocation}
          onLocationChange={setSelectedLocation}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          sortValue={sortOption}
          onSortChange={setSortOption}
          onOpenFilters={handleOpenFilters}
          hasActiveFilters={hasActiveFilters}
        />
        <FilterChips chips={activeChips} onRemove={handleRemoveChip} onClearAll={activeChips.length ? handleClearAll : undefined} />
      </section>

      {error ? (
        <div className="coaches-page__state coaches-page__state--error" role="alert">
          <AlertTriangle aria-hidden size={20} />
          <div>
            <p>We couldn&apos;t load coaches right now.</p>
            <button type="button" onClick={fetchCoaches}>
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {loading && !coaches.length ? (
        <section className="coaches-page__skeletons" aria-hidden>
          <div className="featured-coach-card skeleton-block" />
          <div className="coaches-page__grid-skeleton">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="coach-card skeleton-block" />
            ))}
          </div>
        </section>
      ) : null}

      {!loading && !error ? (
        <section className="coaches-page__content" aria-live="polite">
          <header className="coaches-page__section-header">
            <div>
              <h2>Featured Coaches</h2>
              <p>Handpicked pros with outstanding reviews.</p>
            </div>
            <span className="coaches-page__count">{filteredCoaches.length} coaches found</span>
          </header>
          {featuredCoaches.length ? (
            <div className="coaches-page__featured-grid">
              {featuredCoaches.map((coach) => (
                <FeaturedCoachCard key={coach.id} coach={coach} />
              ))}
            </div>
          ) : (
            <p className="coaches-page__empty">No featured coaches available.</p>
          )}

          <div className="coaches-page__section-header">
            <div>
              <h2>All Coaches</h2>
              <p>Browse every available coach that matches your filters.</p>
            </div>
          </div>
          {remainingCoaches.length ? (
            <div className="coaches-page__grid">
              {remainingCoaches.map((coach) => (
                <CoachCard key={coach.id} coach={coach} />
              ))}
            </div>
          ) : (
            <div className="coaches-page__state coaches-page__state--empty">
              <p>No coaches found. Try adjusting your filters.</p>
            </div>
          )}
        </section>
      ) : null}

      {isFilterModalOpen ? (
        <div className="coaches-page__filter-modal" role="dialog" aria-modal="true" aria-label="Filter coaches">
          <div className="coaches-page__filter-modal-content">
            <header>
              <h3>Filter by specialties</h3>
              <button type="button" onClick={handleCloseFilters} className="coaches-page__filter-modal-close">
                Close
              </button>
            </header>
            <div className="coaches-page__filter-modal-body">
              {specialtyOptions.length ? (
                <ul>
                  {specialtyOptions.map((specialty) => {
                    const id = `specialty-${specialty.replace(/\s+/g, "-").toLowerCase()}`;
                    const isChecked = pendingSpecialties.includes(specialty);
                    return (
                      <li key={specialty}>
                        <label htmlFor={id}>
                          <input
                            id={id}
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleTogglePendingSpecialty(specialty)}
                          />
                          {specialty}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="coaches-page__filter-placeholder">
                  {/* TODO: replace with API-driven specialties */}
                  Specialties will appear once available.
                </p>
              )}
            </div>
            <footer>
              <button type="button" onClick={() => setPendingSpecialties([])}>
                Clear
              </button>
              <button type="button" className="primary" onClick={handleApplyFilters}>
                Apply filters
              </button>
            </footer>
          </div>
          <button type="button" className="coaches-page__filter-modal-backdrop" onClick={handleCloseFilters} aria-label="Close filters" />
        </div>
      ) : null}

      {loading && coaches.length ? (
        <div className="coaches-page__loading" aria-live="polite">
          <Loader2 aria-hidden className="spin" size={20} />
          <span>Updating results…</span>
        </div>
      ) : null}
    </main>
  );
};

export default CoachesPage;
