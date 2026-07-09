import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  CircleAlert,
  CircleDot,
  Search,
  Trophy,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  getLeagueMatchNeeds,
  listLeagues,
  type League,
  type LeagueSections,
} from "../api/leagues";
import type { PlayerPersonalDetails } from "../api/playerProfile";
import { getPlayerPersonalDetails } from "../api/playerProfile";
import AuthDrawer from "../components/auth/AuthDrawer";
import MainLayout from "../components/MainLayout";
import { useAuth } from "../context/AuthContext";
import LeagueJoinReviewSheet from "../features/leagueJoin/LeagueJoinReviewSheet";
import { getStoredAuthToken } from "../services/authToken";
import { isFutureLeagueItem } from "./leagueDetailTime";
import {
  requestLeagueJoin,
  resumePendingLeagueJoin,
  type PendingLeagueJoinRequest,
} from "./leagueAuthGate";
import {
  filterAvailableLeagues,
  getLeagueCapacity,
  getLeagueCardVariant,
  type LeagueBrowseAvailableFilter,
  type LeagueCardVariant,
} from "./leagueBrowse";

import "./LeaguesPage.css";

type BrowseTopFilter = "all" | "available" | "mine" | "archived";

const EMPTY_SECTIONS: LeagueSections = {
  mine: [],
  available: [],
  archived: [],
};

const TOP_FILTERS: Array<{
  value: BrowseTopFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "mine", label: "My leagues" },
  { value: "archived", label: "Archived" },
];

const AVAILABLE_FILTERS: Array<{
  value: LeagueBrowseAvailableFilter;
  label: string;
}> = [
  { value: "for-you", label: "For you" },
  { value: "all-levels", label: "All levels" },
  { value: "men", label: "Men's" },
  { value: "women", label: "Women's" },
  { value: "mixed", label: "Mixed" },
];

const formatDate = (value?: string) => {
  if (!value) return "Dates TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatRange = (league: League) => {
  const start = formatDate(league.start_date);
  const end = formatDate(league.deadline);
  if (start === "Dates TBD" && end === "Dates TBD") return "Dates TBD";
  return `${start} - ${end}`;
};

const formatMoney = (value: unknown) => {
  const costCents = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(costCents)) {
    return "$0";
  }
  return `$${(costCents / 100).toFixed(0)}`;
};

const getApiErrorMessage = (error: unknown) => {
  const apiError = error as {
    data?: { detail?: string; error?: string; errors?: string[] };
    message?: string;
  };

  if (apiError.data?.detail) return apiError.data.detail;
  if (apiError.data?.errors?.length) return apiError.data.errors.join(", ");
  return apiError.data?.error || apiError.message || "We couldn't load your profile for league join.";
};

const getSectionTitle = (filter: BrowseTopFilter) => {
  switch (filter) {
    case "available":
      return "Available leagues";
    case "mine":
      return "My leagues";
    case "archived":
      return "Archived leagues";
    default:
      return "Browse leagues";
  }
};

const getEmptyCopy = ({
  filter,
  availableFilter,
  isAuthenticated,
}: {
  filter: BrowseTopFilter;
  availableFilter: LeagueBrowseAvailableFilter;
  isAuthenticated: boolean;
}) => {
  switch (filter) {
    case "available":
      if (availableFilter === "for-you") {
        return {
          title: "Nothing matches your profile yet",
          body: "Try All levels to see every public league, including ones that need more profile details before we can narrow them down.",
        };
      }

      return {
        title: "No public leagues available",
        body: "Check back soon for the next flex league opening.",
      };
    case "mine":
      return isAuthenticated
        ? {
            title: "You have not joined a league yet",
            body: "Leagues you join will show up here with standings, players, and match activity.",
          }
        : {
            title: "No joined leagues to show",
            body: "Sign in to track leagues you join and keep your place on the schedule.",
          };
    case "archived":
      return {
        title: "No archived leagues yet",
        body: "Completed seasons will appear here once they are wrapped up.",
      };
    default:
      return {
        title: "No leagues to browse",
        body: "When leagues open up, they will appear here with public season details.",
      };
  }
};

const normalizeSections = (sections?: LeagueSections | null): LeagueSections => ({
  mine: sections?.mine ?? [],
  available: sections?.available ?? [],
  archived: sections?.archived ?? [],
});

const SectionEmptyState = ({
  title,
  body,
}: {
  title: string;
  body: string;
}) => (
  <div className="leagues-page__empty leagues-page__empty--section">
    <Search size={24} />
    <h3>{title}</h3>
    <p>{body}</p>
  </div>
);

const LeagueCard = ({
  league,
  variant,
  lookingCount,
  joinPending,
  onJoin,
  archived = false,
}: {
  league: League;
  variant: LeagueCardVariant;
  lookingCount: number;
  joinPending: boolean;
  onJoin: (leagueId: League["id"]) => void;
  archived?: boolean;
}) => {
  const capacity = getLeagueCapacity(league);
  const metaText =
    [league.skill_band, league.gender, league.status].filter(Boolean).join(" · ") ||
    "Flex league";

  return (
    <article className={`browse-league-card browse-league-card--${variant}`}>
      <div className="browse-league-card__header">
        <div className="browse-league-card__title-group">
          <span className="browse-league-card__icon">
            <Trophy size={18} />
          </span>
          <div>
            <div className="browse-league-card__headline">
              <h2>{league.name}</h2>
              <span className={`browse-league-card__badge browse-league-card__badge--${archived ? "archived" : variant}`}>
                {archived ? "Archived" : variant === "enrolled" ? "Enrolled" : variant === "full" ? "Full" : "Open"}
              </span>
            </div>
            <p>{metaText}</p>
          </div>
        </div>
        {variant === "enrolled" && lookingCount > 0 ? (
          <span className="browse-league-card__looking">
            <Users size={14} />
            {lookingCount} looking
          </span>
        ) : null}
      </div>

      <div className="browse-league-card__meta">
        <span>
          <CalendarDays size={14} />
          {formatRange(league)}
        </span>
        <span>
          <CircleDot size={14} />
          {formatMoney(league.cost_cents)}
        </span>
        <span>
          <Users size={14} />
          {league.membership_status ?? "Public league"}
        </span>
      </div>

      <div className="browse-league-card__capacity">
        <div className="browse-league-card__capacity-head">
          <strong>Capacity</strong>
          <span>
            {capacity.total != null && capacity.filled != null
              ? `${capacity.filled}/${capacity.total} spots filled`
              : capacity.isFull
                ? "League is full"
                : "Capacity TBD"}
          </span>
        </div>
        <div className="browse-league-card__capacity-bar" aria-hidden="true">
          <span style={{ width: `${capacity.progressPercent}%` }} />
        </div>
      </div>

      <div className="browse-league-card__actions">
        {archived ? null : variant === "available" ? (
          <button type="button" className="browse-league-card__join" onClick={() => onJoin(league.id)}>
            {joinPending ? "Selected" : "Join"}
          </button>
        ) : variant === "full" ? (
          <button type="button" className="browse-league-card__join browse-league-card__join--disabled" disabled>
            Full
          </button>
        ) : null}
        <Link className="browse-league-card__view" to={`/leagues/${league.id}`}>
          View league
          <ChevronRight size={16} />
        </Link>
      </div>
    </article>
  );
};

const LoadingSkeleton = () => (
  <div className="leagues-page__grid" aria-hidden="true">
    {Array.from({ length: 4 }).map((_, index) => (
      <article key={index} className="browse-league-card browse-league-card--skeleton">
        <div className="browse-league-card__skeleton browse-league-card__skeleton--title" />
        <div className="browse-league-card__skeleton browse-league-card__skeleton--meta" />
        <div className="browse-league-card__skeleton browse-league-card__skeleton--meta" />
        <div className="browse-league-card__skeleton browse-league-card__skeleton--bar" />
        <div className="browse-league-card__skeleton browse-league-card__skeleton--actions" />
      </article>
    ))}
  </div>
);

const LeaguesPage = () => {
  const { isAuthenticated, user } = useAuth();
  const token = useMemo(
    () =>
      user?.session?.access_token ??
      user?.access_token ??
      user?.token ??
      getStoredAuthToken({ preferScheme: "token" }) ??
      undefined,
    [user],
  );
  const [topFilter, setTopFilter] = useState<BrowseTopFilter>("all");
  const [availableFilter, setAvailableFilter] =
    useState<LeagueBrowseAvailableFilter>("for-you");
  const [sections, setSections] = useState<LeagueSections>(EMPTY_SECTIONS);
  const [profile, setProfile] = useState<PlayerPersonalDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinIntentLeagueId, setJoinIntentLeagueId] = useState<string | number | null>(null);
  const [pendingJoinRequest, setPendingJoinRequest] = useState<PendingLeagueJoinRequest | null>(null);
  const [authDrawerOpen, setAuthDrawerOpen] = useState(false);
  const [reviewLeagueId, setReviewLeagueId] = useState<string | number | null>(null);
  const [reviewProfile, setReviewProfile] = useState<PlayerPersonalDetails | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [joinFlowMessage, setJoinFlowMessage] = useState<string | null>(null);
  const [lookingCounts, setLookingCounts] = useState<Record<string, number>>({});
  const [archivedLoaded, setArchivedLoaded] = useState(false);

  const leagueById = useMemo(() => {
    const entries = [...sections.mine, ...sections.available, ...sections.archived].map((league) => [
      String(league.id),
      league,
    ] as const);
    return new Map(entries);
  }, [sections.archived, sections.available, sections.mine]);

  const loadReviewProfile = useCallback(async () => {
    if (!token) {
      setReviewProfile(null);
      setReviewError("Please sign in again to continue.");
      return;
    }

    const response = await getPlayerPersonalDetails({ token });
    setReviewProfile(response);
    setReviewError(null);
  }, [token]);

  const openJoinReview = useCallback(async (leagueId: string | number) => {
    setJoinIntentLeagueId(leagueId);
    setReviewLeagueId(leagueId);
    setReviewLoading(true);
    setReviewError(null);

    try {
      await loadReviewProfile();
    } catch (error) {
      setReviewProfile(null);
      setReviewError(getApiErrorMessage(error));
    } finally {
      setReviewLoading(false);
    }
  }, [loadReviewProfile]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setArchivedLoaded(false);

    listLeagues({ token, signal: controller.signal })
      .then((response) => {
        const nextSections = normalizeSections(response.sections);
        setSections({
          mine: nextSections.mine,
          available: nextSections.available,
          archived: [],
        });
      })
      .catch((err) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(err instanceof Error ? err.message : "Failed to load leagues");
        setSections(EMPTY_SECTIONS);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (topFilter !== "archived" || archivedLoaded) {
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    listLeagues({ segment: "archived", token, signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) {
          return;
        }

        const nextSections = normalizeSections(response.sections);
        setSections((current) => ({
          ...current,
          archived:
            nextSections.archived.length > 0
              ? nextSections.archived
              : response.leagues ?? [],
        }));
        setArchivedLoaded(true);
      })
      .catch((err) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(err instanceof Error ? err.message : "Failed to load archived leagues");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [archivedLoaded, token, topFilter]);

  useEffect(() => {
    if (!token || !isAuthenticated) {
      setProfile(null);
      return;
    }

    const controller = new AbortController();
    getPlayerPersonalDetails({ token, signal: controller.signal })
      .then((response) => {
        setProfile(response);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setProfile(null);
        }
      });

    return () => controller.abort();
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (!pendingJoinRequest || !isAuthenticated || !token) {
      return;
    }

    const resumed = resumePendingLeagueJoin({
      isAuthenticated,
      pending: pendingJoinRequest,
    });

    if (resumed.action !== "open_review") {
      return;
    }

    setPendingJoinRequest(resumed.pending);
    setAuthDrawerOpen(false);
    void openJoinReview(resumed.leagueId);
  }, [isAuthenticated, openJoinReview, pendingJoinRequest, token]);

  useEffect(() => {
    if (!token || sections.mine.length === 0) {
      setLookingCounts({});
      return;
    }

    const controller = new AbortController();
    Promise.all(
      sections.mine.map(async (league) => {
        try {
          const [personal, all] = await Promise.all([
            getLeagueMatchNeeds({ leagueId: league.id, token, signal: controller.signal }),
            getLeagueMatchNeeds({
              leagueId: league.id,
              token,
              scope: "all",
              signal: controller.signal,
            }),
          ]);
          const count =
            (all.needs ?? []).filter(isFutureLeagueItem).length ||
            (personal.suggestions ?? []).filter(isFutureLeagueItem).length;
          return [String(league.id), count] as const;
        } catch {
          return [String(league.id), 0] as const;
        }
      }),
    ).then((entries) => {
      if (!controller.signal.aborted) {
        setLookingCounts(Object.fromEntries(entries));
      }
    });

    return () => controller.abort();
  }, [sections.mine, token]);

  const filteredAvailableLeagues = useMemo(
    () => filterAvailableLeagues(sections.available, availableFilter, profile),
    [availableFilter, profile, sections.available],
  );

  const visibleCards = useMemo(() => {
    switch (topFilter) {
      case "available":
        return filteredAvailableLeagues;
      case "mine":
        return sections.mine;
      case "archived":
        return sections.archived;
      default:
        return [...sections.mine, ...filteredAvailableLeagues];
    }
  }, [filteredAvailableLeagues, sections.archived, sections.mine, topFilter]);

  const topFilterCounts = useMemo(
    () => ({
      all: sections.mine.length + filteredAvailableLeagues.length,
      available: filteredAvailableLeagues.length,
      mine: sections.mine.length,
      archived: sections.archived.length,
    }),
    [filteredAvailableLeagues.length, sections.archived.length, sections.mine.length],
  );

  const emptyCopy = getEmptyCopy({ filter: topFilter, availableFilter, isAuthenticated });

  const showAvailableSubfilters = topFilter === "all" || topFilter === "available";
  const hasVisibleCards = visibleCards.length > 0;
  const reviewLeague = reviewLeagueId != null ? leagueById.get(String(reviewLeagueId)) ?? null : null;

  const handleJoinRequest = (leagueId: League["id"]) => {
    setJoinFlowMessage(null);

    const result = requestLeagueJoin({
      isAuthenticated,
      leagueId,
    });

    if (result.action === "open_auth") {
      setPendingJoinRequest(result.pending);
      setJoinIntentLeagueId(leagueId);
      setAuthDrawerOpen(true);
      return;
    }

    if (result.action === "open_review") {
      void openJoinReview(result.leagueId);
    }
  };

  return (
    <MainLayout pageClassName="leagues-shell" mobileChrome="home" hideMobileNewMatch>
      <section className="leagues-page">
        <header className="leagues-page__header leagues-page__header--stacked">
          <div>
            <p className="leagues-page__eyebrow">League browse</p>
            <h1>{getSectionTitle(topFilter)}</h1>
            <p>Browse public flex leagues, track the ones you have joined, and see where the next season still has room.</p>
          </div>
        </header>

        <div className="leagues-page__controls">
          <div className="leagues-page__segmented" role="tablist" aria-label="League browse sections">
            {TOP_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={topFilter === filter.value ? "is-active" : undefined}
                onClick={() => setTopFilter(filter.value)}
              >
                <span>{filter.label}</span>
                <strong>{topFilterCounts[filter.value]}</strong>
              </button>
            ))}
          </div>

          {showAvailableSubfilters ? (
            <div className="leagues-page__subfilters" role="tablist" aria-label="Available league filters">
              {AVAILABLE_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={availableFilter === filter.value ? "is-active" : undefined}
                  onClick={() => setAvailableFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {joinFlowMessage ? (
          <div className="leagues-page__notice">
            <CircleAlert size={16} />
            {joinFlowMessage}
          </div>
        ) : null}

        {loading ? <LoadingSkeleton /> : null}
        {error ? <div className="leagues-page__state leagues-page__state--error">{error}</div> : null}

        {!loading && !error ? (
          topFilter === "all" ? (
            <div className="leagues-page__sections">
              <section className="leagues-page__section">
                <div className="leagues-page__section-head">
                  <h2>My leagues</h2>
                  <span>{sections.mine.length}</span>
                </div>
                {sections.mine.length > 0 ? (
                  <div className="leagues-page__grid">
                    {sections.mine.map((league) => (
                      <LeagueCard
                        key={`mine-${league.id}`}
                        league={league}
                        variant={getLeagueCardVariant(league)}
                        lookingCount={lookingCounts[String(league.id)] ?? 0}
                        joinPending={joinIntentLeagueId === league.id}
                        onJoin={handleJoinRequest}
                      />
                    ))}
                  </div>
                ) : (
                  <SectionEmptyState
                    title={isAuthenticated ? "You have not joined any leagues" : "No joined leagues yet"}
                    body={
                      isAuthenticated
                        ? "Joined leagues will move to this section as soon as you are added."
                        : "When you sign in and join a league, it will be grouped here."
                    }
                  />
                )}
              </section>

              <section className="leagues-page__section">
                <div className="leagues-page__section-head">
                  <h2>{availableFilter === "for-you" ? "Available for you" : "Available leagues"}</h2>
                  <span>{filteredAvailableLeagues.length}</span>
                </div>
                {filteredAvailableLeagues.length > 0 ? (
                  <div className="leagues-page__grid">
                    {filteredAvailableLeagues.map((league) => (
                      <LeagueCard
                        key={`available-${league.id}`}
                        league={league}
                        variant={getLeagueCardVariant(league)}
                        lookingCount={0}
                        joinPending={joinIntentLeagueId === league.id}
                        onJoin={handleJoinRequest}
                      />
                    ))}
                  </div>
                ) : (
                  <SectionEmptyState
                    title={
                      availableFilter === "for-you"
                        ? "No leagues match your current profile"
                        : "No public leagues available right now"
                    }
                    body={
                      availableFilter === "for-you"
                        ? "Switch to All levels to browse every public season while you finish your profile."
                        : "Check back soon for the next league launch."
                    }
                  />
                )}
              </section>
            </div>
          ) : hasVisibleCards ? (
            <div className="leagues-page__grid">
              {visibleCards.map((league) => (
                <LeagueCard
                  key={`${topFilter}-${league.id}`}
                  league={league}
                  variant={getLeagueCardVariant(league)}
                  lookingCount={topFilter === "mine" ? lookingCounts[String(league.id)] ?? 0 : 0}
                  joinPending={joinIntentLeagueId === league.id}
                  onJoin={handleJoinRequest}
                  archived={topFilter === "archived"}
                />
              ))}
            </div>
          ) : (
            <div className="leagues-page__empty">
              <Search size={28} />
              <h2>{emptyCopy.title}</h2>
              <p>{emptyCopy.body}</p>
            </div>
          )
        ) : null}

        <AuthDrawer
          open={authDrawerOpen}
          onClose={() => {
            setPendingJoinRequest(null);
            setJoinIntentLeagueId(null);
            setAuthDrawerOpen(false);
          }}
          onAuthenticated={() => {
            setAuthDrawerOpen(false);
          }}
          initialMode="signup"
          title="Join the league"
          subtitle="Sign in or create an account to review league eligibility and continue."
        />

        {reviewLeague ? (
          <LeagueJoinReviewSheet
            league={reviewLeague}
            profile={reviewProfile}
            token={token}
            loading={reviewLoading}
            profileError={reviewError}
            onClose={() => {
              setReviewLeagueId(null);
              setJoinIntentLeagueId(null);
            }}
            onEligible={() => {
              setJoinFlowMessage(`Profile saved for ${reviewLeague.name}. Agreement, payment, and enrollment stay out of scope for Task 5.`);
              setReviewLeagueId(null);
              setJoinIntentLeagueId(null);
            }}
          />
        ) : null}
      </section>
    </MainLayout>
  );
};

export default LeaguesPage;
