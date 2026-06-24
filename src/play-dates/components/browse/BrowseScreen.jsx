import { useEffect, useRef, useState } from "react";
import Autocomplete from "react-google-autocomplete";
import {
  Users,
  AlertCircle,
  RefreshCw,
  MapPin,
  Search,
  Calendar,
  SlidersHorizontal,
  ChevronDown,
  Check,
  X,
  Plus,
} from "lucide-react";

import MatchCard from "./MatchCard";

// Extracted from TennisMatchApp.jsx (Step 0), restyled to the v2 design. Every
// value the screen reads (state, setters, derived data, handlers, helpers, and
// the module-level constants/formatters) is passed in as a prop so the parent
// keeps owning the state and data flow.
const BrowseScreen = ({
  currentUser,
  distanceFilter,
  setDistanceFilter,
  setMatchPage,
  setActiveFilter,
  locationFilter,
  setLocationFilter,
  recentLocations,
  matchSearch,
  setMatchSearch,
  selectedDayKey,
  setSelectedDayKey,
  selectedLevelFilter,
  setSelectedLevelFilter,
  selectedFormatFilter,
  setSelectedFormatFilter,
  selectedGenderFilter,
  setSelectedGenderFilter,
  setCurrentScreen,
  setShowSignInModal,
  matchesNeedingAttention,
  distanceOptions,
  allWeekMatchCount,
  dayStripOptions,
  matchCountsByDay,
  displayedMatches,
  hasLocationFilter,
  groupedDisplayedMatches,
  refreshMatchesAndInvites,
  handleViewDetails,
  openInviteScreen,
  handleUseBrowseLocation,
  formatHoursUntilStart,
  formatDateTime,
  getMatchCount,
  formatMatchTimeLabel,
  formatDistanceLabel,
  NTRP_LEVELS,
  DISCOVERY_FORMAT_FILTERS,
  DISCOVERY_GENDER_FILTERS,
}) => {
    // Presentational tab state. "My Matches" and "Hosting" both fetch with
    // activeFilter="my"; Hosting additionally client-filters to hosted matches.
    const [scopeTab, setScopeTab] = useState("discover");
    // Which collapsed control is open: "level" | "format" | "filters" | null.
    const [openMenu, setOpenMenu] = useState(null);
    const controlsRef = useRef(null);
    const topAttentionMatches = matchesNeedingAttention.slice(0, 3);

    const userNtrp =
      currentUser?.skillLevel ?? currentUser?.usta_rating ?? currentUser?.skill_level ?? "";

    const isHosting = scopeTab === "hosting";
    const visibleGroups = isHosting
      ? groupedDisplayedMatches
          .map((group) => ({
            ...group,
            matches: group.matches.filter((match) => match.type === "hosted"),
          }))
          .filter((group) => group.matches.length > 0)
      : groupedDisplayedMatches;
    const visibleMatchCount = isHosting
      ? visibleGroups.reduce((total, group) => total + group.matches.length, 0)
      : displayedMatches.length;

    // Close any open dropdown/sheet on outside-click or Escape. Ignore clicks on
    // the Google Places suggestion list (.pac-container is appended to <body>, so
    // it counts as "outside" but must not close the Filters panel mid-select).
    useEffect(() => {
      if (!openMenu) return undefined;
      const onPointerDown = (event) => {
        if (event.target.closest?.(".pac-container")) return;
        if (controlsRef.current && !controlsRef.current.contains(event.target)) {
          setOpenMenu(null);
        }
      };
      const onKeyDown = (event) => {
        if (event.key === "Escape") setOpenMenu(null);
      };
      document.addEventListener("mousedown", onPointerDown);
      document.addEventListener("keydown", onKeyDown);
      return () => {
        document.removeEventListener("mousedown", onPointerDown);
        document.removeEventListener("keydown", onKeyDown);
      };
    }, [openMenu]);

    const renderFilterChip = ({
      key,
      active,
      onClick,
      children,
      disabled = false,
      size = "default",
    }) => (
      <button
        key={key}
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`relative inline-flex items-center justify-center rounded-full border font-black transition-colors ${
          size === "compact" ? "min-h-8 px-3 text-[11px]" : "min-h-8 px-3 text-[12px]"
        } ${
          active
            ? "border-violet-500 bg-violet-500 text-white"
            : disabled
            ? "border-slate-200 bg-white text-slate-300"
            : "border-slate-200 bg-white text-slate-700 hover:border-violet-200 hover:text-violet-700"
        }`}
      >
        {children}
      </button>
    );

    // Working quick-chip dropdown (Level / Format) — same interaction pattern as
    // the v2 reference's Level menu: toggle, select → apply + close.
    const renderQuickFilter = ({ menuKey, label, value, options, onSelect }) => (
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpenMenu(openMenu === menuKey ? null : menuKey)}
          className={`inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-[10px] border bg-white px-2.5 py-2 text-[11px] font-extrabold transition hover:bg-slate-50 sm:gap-1.5 sm:px-3 sm:text-[12.5px] ${
            value && value !== "Any"
              ? "border-violet-300 text-violet-700"
              : "border-slate-200 text-slate-700"
          }`}
        >
          {label}: {value}
          <ChevronDown className="h-2.5 w-2.5 opacity-60 sm:h-3 sm:w-3" />
        </button>
        {openMenu === menuKey && (
          <div className="absolute left-0 top-[calc(100%+8px)] z-50 min-w-[180px] overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-lg">
            {options.map((option) => {
              const selected = value === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onSelect(option);
                    setMatchPage(1);
                    setOpenMenu(null);
                  }}
                  className={`flex w-full items-center gap-2 border-b border-slate-100 px-4 py-3 text-left text-[13.5px] font-bold last:border-0 hover:bg-slate-50 ${
                    selected ? "text-violet-700" : "text-slate-700"
                  }`}
                >
                  <Check className={`h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`} />
                  {option}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );

    return (
      // Absorb the parent `.dashboard-page` flex gap (32px between AppNav and
      // content) on mobile only — desktop keeps it. Scoped here so other
      // .dashboard-page screens are unaffected.
      <div className="-mt-6 min-h-screen bg-slate-50 sm:mt-0">
        {currentUser ? (
          <main className="mx-auto max-w-[1280px] px-4 pb-16 pt-3 sm:px-6 sm:pt-7 lg:px-10">
            <section className="mb-6 flex items-start justify-between gap-3">
              <div>
                <h1 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-slate-900">
                  Match Play
                </h1>
                <p className="mt-0.5 text-[13px] font-bold text-emerald-700">
                  {allWeekMatchCount} open near you this week
                </p>
              </div>
              {/* AppNav already renders "New match" on desktop (hidden on mobile via
                  hideMobileNewMatch), so this header Create is mobile-only to avoid a
                  duplicate. Same create path as the empty-state button. */}
              <button
                type="button"
                onClick={() => setCurrentScreen("create")}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-[11px] bg-gradient-to-br from-violet-500 to-violet-600 px-3.5 py-2.5 text-[13.5px] font-extrabold text-white shadow-md transition hover:from-violet-600 hover:to-violet-700 sm:hidden"
              >
                <Plus className="h-4 w-4" />
                Create
              </button>
            </section>

            {topAttentionMatches.length > 0 && (
              <section className="mb-7">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    Needs your attention
                  </div>
                  <button
                    type="button"
                    onClick={() => refreshMatchesAndInvites()}
                    className="inline-flex items-center gap-1.5 text-sm font-black text-violet-500 transition hover:text-violet-700"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </button>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  {topAttentionMatches.map((match) => {
                    const lowOccupancy = match.alerts?.lowOccupancy || {};
                    const spotsNeeded = Number(
                      lowOccupancy.spotsNeeded ?? match.rosterSpotsRemaining ?? 0,
                    );
                    const rosterCount =
                      lowOccupancy.rosterCount ?? match.rosterCount ?? match.occupied;
                    const playerLimit = lowOccupancy.playerLimit ?? match.playerLimit;
                    return (
                      <article
                        key={`attention-${match.id}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleViewDetails(match.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleViewDetails(match.id);
                          }
                        }}
                        className="cursor-pointer rounded-[14px] border border-amber-100 border-l-[3px] border-l-amber-500 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700">
                            <AlertCircle className="h-3 w-3" />
                            Needs players
                          </span>
                          <span className="text-[11px] font-bold text-slate-500">
                            {formatHoursUntilStart(lowOccupancy.hoursUntilStart) || "Soon"}
                          </span>
                        </div>
                        <h3 className="text-[15px] font-black leading-snug text-slate-950">
                          Need {spotsNeeded} more {spotsNeeded === 1 ? "player" : "players"}
                        </h3>
                        <p className="mt-1.5 text-xs font-semibold leading-5 text-slate-500">
                          {match.format || "Match"} at {match.location || "Location TBA"}
                        </p>
                        <div className="mt-2.5 space-y-1 text-xs font-semibold text-slate-500">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDateTime(match.dateTime)}
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="h-3.5 w-3.5" />
                            {rosterCount}
                            {playerLimit ? `/${playerLimit}` : ""} confirmed
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openInviteScreen(match.id);
                            }}
                            className="rounded-[10px] bg-amber-500 px-3.5 py-2 text-xs font-black text-white transition hover:bg-amber-600"
                          >
                            Manage invites
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleViewDetails(match.id);
                            }}
                            className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                          >
                            View match
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="mb-5 rounded-[16px] border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
              <div ref={controlsRef} className="relative flex flex-col gap-3">
                <div className="flex gap-[3px] rounded-[11px] bg-slate-100 p-[3px]">
                  {[
                    { id: "discover", label: "Discover", filter: "discover" },
                    { id: "my", label: "My Matches", filter: "my" },
                    { id: "hosting", label: "Hosting", filter: "my" },
                  ].map((tab) => {
                    const isActive = scopeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setScopeTab(tab.id);
                          setActiveFilter(tab.filter);
                          setMatchPage(1);
                        }}
                        className={`flex-1 rounded-[9px] px-1.5 py-2 text-center text-[12.5px] transition-colors ${
                          isActive
                            ? "bg-white font-extrabold text-slate-900 shadow-sm"
                            : "font-bold text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-nowrap items-center gap-1.5 sm:flex-wrap sm:gap-2">
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setOpenMenu(openMenu === "filters" ? null : "filters")}
                      className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-[10px] bg-slate-900 px-2.5 py-2 text-[11px] font-extrabold text-white transition hover:bg-slate-800 sm:gap-1.5 sm:px-3 sm:text-[12.5px]"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Filters
                    </button>

                    {openMenu === "filters" && (
                      <>
                        <div
                          className="fixed inset-0 z-40 bg-slate-900/30 sm:hidden"
                          onClick={() => setOpenMenu(null)}
                          aria-hidden="true"
                        />
                        <div className="z-50 border border-slate-200 bg-white shadow-xl max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[82vh] max-sm:overflow-y-auto max-sm:rounded-t-[20px] sm:absolute sm:left-0 sm:top-[calc(100%+8px)] sm:w-[380px] sm:rounded-[16px]">
                          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                            <span className="text-[13px] font-extrabold text-slate-900">Filters</span>
                            <button
                              type="button"
                              onClick={() => setOpenMenu(null)}
                              className="text-slate-400 transition hover:text-slate-700"
                              aria-label="Close filters"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="flex flex-col gap-4 px-4 py-4">
                            <div>
                              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                                Location
                              </p>
                              <div className="relative">
                                <MapPin className="pointer-events-none absolute left-4 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Autocomplete
                                  apiKey={import.meta.env.VITE_GOOGLE_API_KEY}
                                  value={locationFilter?.label || ""}
                                  onChange={(e) => {
                                    setLocationFilter({
                                      label: e.target.value,
                                      lat: null,
                                      lng: null,
                                    });
                                    setMatchPage(1);
                                  }}
                                  onPlaceSelected={(place) => {
                                    const placeName =
                                      typeof place?.name === "string" ? place.name.trim() : "";
                                    const formattedAddress =
                                      typeof place?.formatted_address === "string"
                                        ? place.formatted_address.trim()
                                        : "";
                                    const locationLabel =
                                      placeName || formattedAddress || locationFilter?.label || "";
                                    const lat = place.geometry?.location?.lat?.();
                                    const lng = place.geometry?.location?.lng?.();
                                    setLocationFilter({
                                      label: locationLabel,
                                      lat: typeof lat === "number" ? lat : null,
                                      lng: typeof lng === "number" ? lng : null,
                                    });
                                    setMatchPage(1);
                                  }}
                                  options={{
                                    types: ["establishment"],
                                    fields: ["formatted_address", "geometry", "name"],
                                  }}
                                  className="h-11 w-full rounded-[14px] border border-slate-200 bg-white pl-11 pr-4 text-[12px] font-semibold text-slate-700 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                                  placeholder="e.g., Oceanside Tennis Center"
                                />
                              </div>
                              {recentLocations.length > 0 && (
                                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                                  {recentLocations.slice(0, 4).map((entry) => {
                                    const isActive =
                                      (locationFilter?.label || "").trim().toLowerCase() ===
                                      entry.label.toLowerCase();
                                    return (
                                      <button
                                        key={entry.label}
                                        type="button"
                                        onClick={() => handleUseBrowseLocation(entry)}
                                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-black transition-colors ${
                                          isActive
                                            ? "border-violet-500 bg-violet-500 text-white"
                                            : "border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700"
                                        }`}
                                      >
                                        <MapPin className="h-3.5 w-3.5" />
                                        {entry.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            <div>
                              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                                Search
                              </p>
                              <div className="relative w-full">
                                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                  type="search"
                                  placeholder="Search matches by format or notes..."
                                  value={matchSearch}
                                  onChange={(e) => {
                                    setMatchSearch(e.target.value);
                                    setMatchPage(1);
                                  }}
                                  className="h-11 w-full rounded-[14px] border border-slate-200 bg-white pl-11 pr-4 text-[12px] font-semibold text-slate-700 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                                />
                              </div>
                            </div>

                            <div>
                              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                                Distance
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {distanceOptions.map((distance) => (
                                  <button
                                    key={distance}
                                    type="button"
                                    onClick={() => {
                                      setDistanceFilter(distance);
                                      setMatchPage(1);
                                    }}
                                    className={`h-8 rounded-full border px-3 text-xs font-black transition-colors ${
                                      distanceFilter === distance
                                        ? "border-violet-500 bg-violet-500 text-white shadow-sm"
                                        : "border-slate-200 bg-white text-slate-500 hover:border-violet-200 hover:text-violet-700"
                                    }`}
                                  >
                                    {distance} mi
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                                Gender
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {DISCOVERY_GENDER_FILTERS.map((gender) =>
                                  renderFilterChip({
                                    key: `gender-${gender}`,
                                    active: selectedGenderFilter === gender,
                                    onClick: () => {
                                      setSelectedGenderFilter(gender);
                                      setMatchPage(1);
                                    },
                                    children: gender,
                                    size: "compact",
                                  }),
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="border-t border-slate-100 px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setOpenMenu(null)}
                              className="w-full rounded-[10px] bg-violet-500 py-2.5 text-[13px] font-extrabold text-white transition hover:bg-violet-600"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {renderQuickFilter({
                    menuKey: "level",
                    label: "Level",
                    value: selectedLevelFilter,
                    options: ["Any", ...NTRP_LEVELS],
                    onSelect: setSelectedLevelFilter,
                  })}

                  {renderQuickFilter({
                    menuKey: "format",
                    label: "Format",
                    value: selectedFormatFilter,
                    options: DISCOVERY_FORMAT_FILTERS,
                    onSelect: setSelectedFormatFilter,
                  })}
                </div>
              </div>
            </section>

            {/* Day strip sized/styled to match the home-page strip (.ph-day-tab in
                DashboardPage.css) — kept as its own copy, not a shared component. */}
            <section className="mb-8">
              <div className="scrollbar-hide flex gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDayKey("");
                    setMatchPage(1);
                  }}
                  className={`flex min-w-[50px] flex-none flex-col items-center gap-px rounded-[10px] border-[1.5px] px-2.5 py-1.5 text-center transition-colors ${
                    !selectedDayKey
                      ? "border-violet-500 bg-violet-500 text-white"
                      : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
                  }`}
                >
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wide ${
                      !selectedDayKey ? "text-white/80" : "text-slate-400"
                    }`}
                  >
                    All
                  </span>
                  <span className="text-[15px] font-extrabold leading-none">Wk</span>
                  <span
                    className={`mt-px min-w-[16px] rounded-[6px] px-[5px] py-px text-center text-[8px] font-bold leading-none ${
                      !selectedDayKey ? "bg-white/25 text-white" : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {allWeekMatchCount}
                  </span>
                </button>
                {dayStripOptions.map((day, index) => {
                  const count =
                    matchCountsByDay.get(day.key) ??
                    (day.fallbackCountKey ? getMatchCount(day.fallbackCountKey) : 0);
                  const isActive = selectedDayKey === day.key;
                  const disabled = index > 3 && count === 0;
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => {
                        setSelectedDayKey(day.key);
                        setMatchPage(1);
                      }}
                      disabled={disabled}
                      className={`flex min-w-[50px] flex-none flex-col items-center gap-px rounded-[10px] border-[1.5px] px-2.5 py-1.5 text-center transition-colors ${
                        isActive
                          ? "border-violet-500 bg-violet-500 text-white"
                          : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
                      } ${count === 0 && !isActive ? "opacity-50" : ""}`}
                    >
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wide ${
                          isActive ? "text-white/80" : "text-slate-400"
                        }`}
                      >
                        {day.eyebrow}
                      </span>
                      <span className="text-[15px] font-extrabold leading-none">{day.dayNumber}</span>
                      <span
                        className={`mt-px min-w-[16px] rounded-[6px] px-[5px] py-px text-center text-[8px] font-bold leading-none ${
                          isActive ? "bg-white/25 text-white" : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {visibleMatchCount === 0 ? (
              <div className="rounded-[14px] border border-slate-200 bg-white px-6 py-20 text-center">
                <Search className="mx-auto h-9 w-9 text-slate-300" />
                <div className="mt-3 text-[15px] font-bold text-slate-700">
                  {isHosting
                    ? "You're not hosting any matches yet."
                    : hasLocationFilter
                    ? `No matches within ${distanceFilter} miles of your location yet.`
                    : "No matches found"}
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-500">
                  Try different filters or create one.
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentScreen("create")}
                  className="mt-4 rounded-[10px] bg-violet-500 px-5 py-2.5 text-sm font-black text-white transition hover:bg-violet-600"
                >
                  Create a match
                </button>
              </div>
            ) : (
            <div className="space-y-10">
              {visibleGroups.map((group) => (
                <section key={group.key} className="space-y-4">
                  <div className="flex items-baseline gap-3">
                    <h3
                      className={`text-[18px] font-black uppercase tracking-[0.14em] ${
                        group.dayLabel === "TODAY" ? "text-violet-500" : "text-slate-800"
                      }`}
                    >
                      {group.dayLabel}
                    </h3>
                    {group.dateLabel && (
                      <span className="text-[16px] font-bold text-slate-400">
                        · {group.dateLabel}
                      </span>
                    )}
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-[13px] font-black text-slate-400">
                      {group.matches.length} {group.matches.length === 1 ? "match" : "matches"}
                    </span>
                  </div>
                  <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
                    {group.matches.map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        handleViewDetails={handleViewDetails}
                        userNtrp={userNtrp}
                        formatMatchTimeLabel={formatMatchTimeLabel}
                        formatDistanceLabel={formatDistanceLabel}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
            )}
          </main>
        ) : (
          <div className="mx-auto max-w-7xl px-4 py-10 text-center">
            <p className="mb-6 font-semibold text-slate-600">
              Sign up or log in to view available matches.
            </p>
            <button
              onClick={() => setShowSignInModal(true)}
              className="rounded-xl bg-violet-600 px-6 py-3 font-bold text-white shadow-lg transition hover:bg-violet-700"
            >
              Sign Up / Log In
            </button>
          </div>
        )}
      </div>
    );
};

export default BrowseScreen;
