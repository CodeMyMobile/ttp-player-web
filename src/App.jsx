import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Clock4,
  MapPin,
  Search,
  Star,
  Trophy,
} from "lucide-react";
import CoachCard from "./components/CoachCard.jsx";
import FilterPill from "./components/FilterPill.jsx";
import StateToggle from "./components/StateToggle.jsx";
import designTokens from "./theme/designTokens.js";
import { coachData } from "./data/coaches.js";
import "./App.css";

const radiusOptions = [
  { label: "5 mi", value: 5 },
  { label: "10 mi", value: 10 },
  { label: "20 mi", value: 20 },
  { label: "50 mi", value: 50 },
];

const specialtyOptions = [
  "All Specialties",
  "Juniors",
  "Adults",
  "High Performance",
];

const experienceOptions = [
  "All Experience",
  "1-3 years",
  "4-7 years",
  "8+ years",
];

const availabilityOptions = [
  "All Availability",
  "Morning",
  "Afternoon",
  "Evening",
  "Weekend",
];

const sortOptions = [
  "Recommended",
  "Rating",
  "Price: Low to High",
  "Price: High to Low",
];

const locationActions = [
  { id: "current", label: "Current location" },
  { id: "change", label: "Change location" },
];

function App() {
  const [radius, setRadius] = useState(10);
  const [specialty, setSpecialty] = useState(specialtyOptions[0]);
  const [experience, setExperience] = useState(experienceOptions[0]);
  const [availability, setAvailability] = useState(availabilityOptions[0]);
  const [sort, setSort] = useState(sortOptions[0]);
  const [locationChoice, setLocationChoice] = useState(locationActions[0].id);
  const [query, setQuery] = useState("");
  const [demoState, setDemoState] = useState("default");

  const styleVariables = useMemo(
    () => ({
      "--page-background": designTokens.colors.page,
      "--surface-color": designTokens.colors.surface,
      "--surface-alt": designTokens.colors.surfaceAlt,
      "--border-color": designTokens.colors.border,
      "--muted-color": designTokens.colors.muted,
      "--heading-color": designTokens.colors.heading,
      "--body-color": designTokens.colors.body,
      "--subtle-text": designTokens.colors.subtle,
      "--accent-color": designTokens.colors.accent,
      "--accent-hover": designTokens.colors.accentHover,
      "--accent-soft": designTokens.colors.accentSoft,
      "--highlight-color": designTokens.colors.highlight,
      "--highlight-soft": designTokens.colors.highlightSoft,
      "--warning-color": designTokens.colors.warning,
      "--warning-soft": designTokens.colors.warningSoft,
      "--danger-color": designTokens.colors.danger,
      "--danger-soft": designTokens.colors.dangerSoft,
      "--shadow-card": designTokens.shadows.card,
      "--shadow-soft": designTokens.shadows.soft,
      "--font-body": designTokens.fonts.body,
      "--font-heading": designTokens.fonts.heading,
      "--radius-sm": designTokens.radii.sm,
      "--radius-md": designTokens.radii.md,
      "--radius-lg": designTokens.radii.lg,
      "--radius-xl": designTokens.radii.xl,
    }),
    []
  );

  const filteredCoaches = useMemo(() => {
    if (demoState !== "default") return [];
    return coachData
      .filter((coach) => coach.radius <= radius)
      .filter((coach) =>
        specialty === specialtyOptions[0]
          ? true
          : coach.specialties.includes(specialty)
      )
      .filter((coach) =>
        experience === experienceOptions[0]
          ? true
          : coach.experienceLabel === experience
      )
      .filter((coach) =>
        availability === availabilityOptions[0]
          ? true
          : coach.availability.includes(availability)
      )
      .filter((coach) =>
        query
          ? coach.name.toLowerCase().includes(query.toLowerCase()) ||
            coach.club.toLowerCase().includes(query.toLowerCase())
          : true
      )
      .sort((a, b) => {
        if (sort === "Rating") return b.rating - a.rating;
        if (sort === "Price: Low to High") return a.price - b.price;
        if (sort === "Price: High to Low") return b.price - a.price;
        return a.order - b.order;
      });
  }, [
    availability,
    demoState,
    experience,
    query,
    radius,
    sort,
    specialty,
  ]);

  const renderContent = () => {
    if (demoState === "loading") {
      return (
        <div className="card-grid" aria-live="polite">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="coach-card skeleton" aria-hidden="true">
              <div className="skeleton-line w-40" />
              <div className="skeleton-line w-32" />
              <div className="skeleton-line w-24" />
              <div className="skeleton-line w-52" />
              <div className="skeleton-line w-28" />
              <div className="skeleton-line w-48" />
              <div className="skeleton-line w-36" />
            </div>
          ))}
        </div>
      );
    }

    if (demoState === "error") {
      return (
        <div className="state-panel error" role="alert">
          <div className="state-icon">
            <AlertTriangle size={24} strokeWidth={2} />
          </div>
          <div className="state-content">
            <h3>We couldn’t load coaches right now</h3>
            <p>
              Something went wrong on our side. Please refresh the page or try
              again in a moment.
            </p>
            <button type="button" className="primary-button">
              Retry search
            </button>
          </div>
        </div>
      );
    }

    const coachesToRender =
      demoState === "empty" ? [] : filteredCoaches.slice(0, 6);

    if (!coachesToRender.length) {
      return (
        <div className="state-panel empty" role="status">
          <div className="state-icon">
            <Trophy size={24} strokeWidth={2} />
          </div>
          <div className="state-content">
            <h3>No coaches match your filters yet</h3>
            <p>
              Try expanding your distance range, or clear one of the filters to
              see more certified instructors.
            </p>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setSpecialty(specialtyOptions[0]);
                setExperience(experienceOptions[0]);
                setAvailability(availabilityOptions[0]);
                setSort(sortOptions[0]);
                setQuery("");
                setRadius(10);
                setDemoState("default");
              }}
            >
              Clear filters
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="card-grid" aria-live="polite">
        {coachesToRender.map((coach) => (
          <CoachCard key={coach.id} coach={coach} />
        ))}
      </div>
    );
  };

  return (
    <div className="app" style={styleVariables}>
      <main className="layout">
        <header className="page-header">
          <div className="header-titles">
            <p className="eyebrow">Connect with certified tennis professionals in your area.</p>
            <div className="header-title-row">
              <h1>Find Coaches</h1>
              <StateToggle value={demoState} onChange={setDemoState} />
            </div>
            <p className="subtitle">
              Showing coaches within <strong>{radius} miles</strong> of your
              selected location.
            </p>
          </div>
          <div className="location-controls">
            {locationActions.map((action) => (
              <FilterPill
                key={action.id}
                selected={locationChoice === action.id}
                variant={action.id === "current" ? "filled" : "outline"}
                icon={action.id === "current" ? MapPin : undefined}
                onClick={() => setLocationChoice(action.id)}
              >
                {action.label}
              </FilterPill>
            ))}
          </div>
        </header>

        <section className="radius-section" aria-label="Distance radius">
          <span className="radius-label">Distance</span>
          <div className="radius-group" role="radiogroup" aria-label="Distance radius">
            {radiusOptions.map((option) => (
              <FilterPill
                key={option.value}
                as="button"
                variant={radius === option.value ? "highlight" : "ghost"}
                selected={radius === option.value}
                aria-pressed={radius === option.value}
                onClick={() => setRadius(option.value)}
              >
                {option.label}
              </FilterPill>
            ))}
          </div>
        </section>

        <section className="filters" aria-label="Coach filters">
          <div className="select-group">
            <button
              type="button"
              className="select-trigger"
              aria-haspopup="listbox"
              aria-label="Sort coaches"
            >
              <span>{sort}</span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="select-trigger"
              aria-haspopup="listbox"
              aria-label="Availability filter"
            >
              <span>{availability}</span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="select-trigger"
              aria-haspopup="listbox"
              aria-label="Experience filter"
            >
              <span>{experience}</span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="select-trigger"
              aria-haspopup="listbox"
              aria-label="Specialty filter"
            >
              <span>{specialty}</span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          </div>
          <label className="search-field" htmlFor="coach-search">
            <Search size={18} strokeWidth={2} aria-hidden="true" />
            <input
              id="coach-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, club, or keyword"
            />
          </label>
        </section>

        <section className="coach-summary" aria-live="polite">
          <span className="coach-count">
            {filteredCoaches.length} coaches found
          </span>
          <div className="legend">
            <span className="legend-item">
              <span className="legend-badge available" /> Available
            </span>
            <span className="legend-item">
              <span className="legend-badge featured" /> Featured
            </span>
            <span className="legend-item">
              <Star size={14} aria-hidden="true" /> Top-rated
            </span>
          </div>
        </section>

        {renderContent()}

        <footer className="page-footer" aria-label="Helpful tips">
          <div className="tip-card">
            <div className="tip-icon" aria-hidden="true">
              <Clock4 size={18} strokeWidth={2} />
            </div>
            <div>
              <p className="tip-title">Book early to secure peak hours</p>
              <p className="tip-body">
                Popular instructors fill their evening slots quickly. Reserve a
                recurring lesson to stay on schedule.
              </p>
            </div>
          </div>
          <button type="button" className="primary-button">
            Browse all coaches
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </footer>
      </main>
    </div>
  );
}

export default App;
