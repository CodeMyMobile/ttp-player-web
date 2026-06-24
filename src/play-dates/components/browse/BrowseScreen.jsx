import { useState } from "react";
import Autocomplete from "react-google-autocomplete";
import { Users, AlertCircle, RefreshCw, MapPin, Search, Calendar } from "lucide-react";

import MatchCard from "./MatchCard";

// Extracted verbatim from TennisMatchApp.jsx (Step 0 — pure move, no behavior
// or style changes). Every value the screen reads (state, setters, derived data,
// handlers, helpers, and the module-level constants/formatters) is passed in as
// a prop so the parent keeps owning the state and data flow.
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
  goToGroups,
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

    return (
      <div className="min-h-screen bg-slate-50">
        {currentUser ? (
          <main className="mx-auto max-w-[1280px] px-4 pb-16 pt-7 sm:px-6 lg:px-10">
            <section className="mb-6 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <h1 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-slate-900">
                  Match Play
                </h1>
                <p className="mt-0.5 text-[13px] font-bold text-emerald-700">
                  {allWeekMatchCount} open near you this week
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <button
                  type="button"
                  onClick={goToGroups}
                  className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:border-violet-200 hover:text-violet-700"
                >
                  <Users className="h-4 w-4 text-violet-500" />
                  My groups
                </button>
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

            <section className="mb-8 rounded-[16px] border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
              <div className="mb-4 flex flex-col gap-3.5">
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

                <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_380px]">
                  <div>
                    <p className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
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
                    <p className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
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
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">When</p>
                  <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDayKey("");
                        setMatchPage(1);
                      }}
                      className={`flex min-h-[88px] min-w-[72px] flex-col items-center justify-center gap-1 rounded-[14px] border px-3 py-3 text-center text-[12px] font-black transition-colors ${
                        !selectedDayKey
                          ? "border-violet-500 bg-violet-500 text-white"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      <span className="block text-[10px] uppercase tracking-[0.14em]">All</span>
                      <span className="block text-[18px] leading-none">Wk</span>
                      <span
                        className={`mt-1 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-[2px] text-[9px] leading-none ${
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
                          className={`flex min-h-[88px] min-w-[72px] flex-col items-center justify-center gap-1 rounded-[14px] border px-3 py-3 text-center text-[12px] font-black transition-colors ${
                            isActive
                              ? "border-violet-500 bg-violet-500 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:border-violet-200"
                          } ${count === 0 && !isActive ? "opacity-50" : ""}`}
                        >
                          <span className="block text-[10px] uppercase tracking-[0.14em]">{day.eyebrow}</span>
                          <span className="block text-[18px] leading-none">{day.dayNumber}</span>
                          {count > 0 ? (
                            <span
                              className={`mt-1 h-[5px] w-[5px] rounded-full ${
                                isActive ? "bg-white" : "bg-violet-500"
                              }`}
                              aria-hidden="true"
                            />
                          ) : (
                            <span className="mt-1 h-[5px] w-[5px]" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-2 min-w-[68px] text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Level</span>
                    {["Any", ...NTRP_LEVELS].map((level) =>
                      renderFilterChip({
                        key: `level-${level}`,
                        active: selectedLevelFilter === level,
                        onClick: () => {
                          setSelectedLevelFilter(level);
                          setMatchPage(1);
                        },
                        children: level,
                        size: "compact",
                      }),
                    )}
                  </div>
                  <div className="hidden h-7 w-px bg-slate-200 xl:block" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-2 min-w-[78px] text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Format</span>
                    {DISCOVERY_FORMAT_FILTERS.map((format) =>
                      renderFilterChip({
                        key: `format-${format}`,
                        active: selectedFormatFilter === format,
                        onClick: () => {
                          setSelectedFormatFilter(format);
                          setMatchPage(1);
                        },
                        children: format,
                        size: "compact",
                      }),
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-2 min-w-[78px] text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Gender</span>
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
