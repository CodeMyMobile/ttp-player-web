import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleAlert, MapPin, Search, Share2 } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import {
  getLeagueRules,
  getLeagueMatchNeeds,
  getLeagueFixtures,
  getLeagueStandings,
  listLeagues,
  type League,
  type LeagueEnrollmentResponse,
  type LeagueFixture,
  type LeagueRuleVersion,
  type LeagueSections,
  type LeagueStanding,
} from "../api/leagues";
import {
  buildViewerIdentities,
  computeSeasonProgress,
  fetchSeasonEnrichment,
  isPastLeague,
  matchesViewer,
  weeksRemaining,
  type SeasonEnrichment,
} from "../utils/leagueSeason";
import { resolveLeagueNextAction } from "../utils/leagueNextAction";
import { rankMedal, ordinal } from "../utils/leagueMedal";
import { leaguePhoto } from "../utils/leaguePhoto";
import { leagueVenueDistanceMiles, formatDistanceMiles } from "../utils/distance";
import "./leagueRedesign.tokens.css";
import type { PlayerPersonalDetails } from "../api/playerProfile";
import { getPlayerPersonalDetails } from "../api/playerProfile";
import {
  getPlayerStripePaymentMethods,
  type PlayerStripePaymentMethod,
} from "../api/playerStripe";
import { useAuthDrawer } from "../context/AuthDrawerContext";
import MainLayout from "../components/MainLayout";
import { useAuth } from "../context/AuthContext";
import LeagueAgreementStep from "../features/leagueJoin/LeagueAgreementStep";
import LeagueJoinSuccess from "../features/leagueJoin/LeagueJoinSuccess";
import LeaguePaymentStep from "../features/leagueJoin/LeaguePaymentStep";
import LeagueJoinReviewSheet from "../features/leagueJoin/LeagueJoinReviewSheet";
import { getStoredAuthToken } from "../services/authToken";
import { isFutureLeagueItem } from "./leagueDetailTime";
import { resolveLeagueAuthToken } from "./leagueAuthToken";
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
type JoinStep = "agreement" | "payment" | "success";

const EMPTY_SECTIONS: LeagueSections = {
  mine: [],
  available: [],
  archived: [],
};

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
  const end = formatDate(league.end_date || league.deadline);
  if (start === "Dates TBD" && end === "Dates TBD") return "Dates TBD";
  return `${start} - ${end}`;
};

const getLeagueLocationLabel = (league: League) => {
  const label = league.location ||
    [league.venue_name, league.venue_area].filter(Boolean).join(" · ");
  return typeof label === "string" && label.trim() ? label : "Location TBD";
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

// FE stopgap: the backend can leave a finished/past league under `mine` while the
// viewer's membership is still "active", so it never lands in the archived segment
// and lingers among active leagues. Treat a league as past when its season has
// clearly ended (a finished-ish status, or an end date before today) so we can
// surface it under Past seasons instead. Remove once the backend categorizes these.

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

// ───────────────────────── Stage 2b: redesigned browse cards ─────────────────────────
// Per-enrolled-league data that loads asynchronously AFTER the card is on screen, so the
// page never blocks on N standings/fixtures requests. Undefined = not fetched yet.
type MineEnrichment = SeasonEnrichment;

const levelChipLabel = (league: League): string => {
  const band = typeof league.skill_band === "string" ? league.skill_band.trim() : "";
  const first = band.split(/[\s/–-]+/)[0];
  return first || "TP";
};

// Actual players in the league (spots_filled), not the capacity. Prefer filled so the card
// reflects real enrollment; fall back to total only if filled isn't provided.
const playerCountLabel = (league: League): string | null => {
  const cap = getLeagueCapacity(league);
  if (cap.filled != null) return `${cap.filled} player${cap.filled === 1 ? "" : "s"}`;
  if (cap.total != null) return `${cap.total} spots`;
  return null;
};

// Price from cost_cents. Absent → null (chip omitted; never "$0"/"$NaN"). 0 → "Free".
const priceLabel = (league: League): string | null => {
  if (league.cost_cents == null || league.cost_cents === "") return null;
  const cents = Number(league.cost_cents);
  if (!Number.isFinite(cents)) return null;
  if (cents <= 0) return "Free";
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
};

const seasonLabel = (dateStr?: string | null): string => {
  if (!dateStr) return "Past seasons";
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return "Past seasons";
  const month = parsed.getMonth();
  const year = parsed.getFullYear();
  const season =
    month <= 1 || month === 11 ? "Winter" : month <= 4 ? "Spring" : month <= 7 ? "Summer" : "Fall";
  return `${season} ${year}`;
};

const groupArchivedBySeason = (leagues: League[]): Array<[string, League[]]> => {
  const groups = new Map<string, League[]>();
  leagues.forEach((league) => {
    const label = seasonLabel(league.start_date);
    const bucket = groups.get(label);
    if (bucket) bucket.push(league);
    else groups.set(label, [league]);
  });
  return Array.from(groups.entries());
};

const SkeletonBar = ({ w = "100%" }: { w?: string }) => (
  <span className="ljr-skel" style={{ width: w }} aria-hidden="true" />
);

const PlayingNowCard = ({
  league,
  enrichment,
  lookingCount,
  onOpen,
}: {
  league: League;
  enrichment: MineEnrichment | undefined;
  lookingCount: number;
  onOpen: () => void;
}) => {
  const loading = enrichment?.loading ?? true;
  const preSeason = enrichment?.preSeason ?? false;
  const progress = computeSeasonProgress(enrichment?.matchesPlayed ?? 0);
  // Real match progress from the viewer's fixtures: played (has a score) of scheduled total.
  const matchesPlayed = enrichment?.matchesPlayed ?? 0;
  const matchesTotal = enrichment?.matchesTotal ?? 0;
  const matchesPct = matchesTotal > 0 ? Math.round((matchesPlayed / matchesTotal) * 100) : 0;
  const weeks = weeksRemaining(league.end_date);
  const dateRange = formatRange(league);
  const players = playerCountLabel(league);

  const action = resolveLeagueNextAction({
    preSeason,
    minimumMet: progress.met,
    rankLabel: enrichment?.rank ? ordinal(enrichment.rank) : null,
  });

  const recordBits: string[] = [];
  if (!preSeason && enrichment?.wins != null && enrichment?.losses != null) {
    recordBits.push(`${enrichment.wins}–${enrichment.losses} record`);
  }
  if (weeks != null && weeks > 0) recordBits.push(`${weeks} wk${weeks === 1 ? "" : "s"} left`);

  return (
    <article
      className="ljr-mine-card"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="ljr-mine-top">
        <div className="ljr-level-chip">{levelChipLabel(league)}</div>
        <div className="ljr-mine-head">
          <div className="ljr-mine-title">{league.name}</div>
          <div className="ljr-mine-meta">
            {[dateRange, players].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="ljr-standing">
          {loading ? (
            <SkeletonBar w="42px" />
          ) : preSeason ? (
            <>
              <b>—</b>
              <span>Pre-season</span>
            </>
          ) : enrichment?.rank ? (
            <>
              <b>{ordinal(enrichment.rank)}</b>
              <span>of {enrichment.total ?? "—"}</span>
            </>
          ) : (
            <>
              <b>—</b>
              <span>Not ranked</span>
            </>
          )}
        </div>
      </div>

      <div className="ljr-season">
        <div className="ljr-season-track">
          <div className="ljr-season-fill" style={{ width: `${matchesPct}%` }} />
        </div>
        {loading ? (
          <div className="ljr-season-label">
            <SkeletonBar w="120px" />
          </div>
        ) : (
          <div className="ljr-season-label">
            <span>
              {preSeason && weeks != null && weeks > 0 ? (
                <b>Starts in {weeks} wk{weeks === 1 ? "" : "s"}</b>
              ) : (
                <>
                  <b>
                    {matchesPlayed} of {matchesTotal}
                  </b>{" "}
                  matches played
                </>
              )}
            </span>
            <span>{preSeason ? "Enrolled ✓" : recordBits.join(" · ")}</span>
          </div>
        )}
      </div>

      {!preSeason && lookingCount > 0 ? (
        <span className="ljr-looking-chip">
          <span className="ljr-pulse" />
          {lookingCount} looking for matches →
        </span>
      ) : null}

      {loading ? (
        <span className="ljr-next-action">
          <SkeletonBar w="70%" />
        </span>
      ) : (
        <span className={`ljr-next-action${action.tone === "ok" ? " is-ok" : ""}`}>
          <span className="ljr-next-ico" aria-hidden="true">
            {action.tone === "ok" ? "✓" : "•"}
          </span>
          <span>{action.text}</span>
          <span className="ljr-next-go">{action.cta}</span>
        </span>
      )}
    </article>
  );
};

const DiscoveryCard = ({
  league,
  distanceLabel,
  priceLabel,
  onJoin,
  onDetails,
  onShare,
}: {
  league: League;
  distanceLabel: string | null;
  priceLabel: string | null;
  onJoin: () => void;
  onDetails: () => void;
  onShare: () => void;
}) => {
  const cap = getLeagueCapacity(league);
  const remaining = cap.remaining;
  const hot = remaining != null && remaining > 0 && remaining <= 3;
  const band = typeof league.skill_band === "string" && league.skill_band.trim()
    ? league.skill_band.trim()
    : null;
  const venue = getLeagueLocationLabel(league);

  return (
    <article className="ljr-disc-card">
      <div className="ljr-photo">
        <img src={leaguePhoto(league)} alt="" aria-hidden="true" />
        {remaining != null ? (
          <span className={`ljr-spots-flag${hot ? " is-hot" : ""}`}>
            {remaining > 0 ? (hot ? `Only ${remaining} spot${remaining === 1 ? "" : "s"} left` : `${remaining} spots open`) : "Full"}
          </span>
        ) : null}
        {band ? <span className="ljr-lvl-flag">{band}</span> : null}
      </div>
      <div className="ljr-disc-body">
        <div className="ljr-disc-title">{league.name}</div>
        <div className="ljr-spec-row">
          <span className="ljr-spec">{formatRange(league)}</span>
          {venue || distanceLabel ? (
            <span className="ljr-spec is-dist">
              {[venue, distanceLabel].filter(Boolean).join(" · ")}
            </span>
          ) : null}
          {priceLabel ? <span className="ljr-spec">{priceLabel}</span> : null}
        </div>
        <div className="ljr-people-row">
          <span className="ljr-who">
            {cap.filled != null ? <b>{cap.filled} players in</b> : "Open for players"}
            {band ? ` · all inside ${band}` : ""}
          </span>
        </div>
        <div className="ljr-disc-foot">
          <button type="button" className="ljr-btn-join" onClick={onJoin}>
            Join this league
          </button>
          <button type="button" className="ljr-btn-ghost" onClick={onDetails}>
            Details
          </button>
          <button type="button" className="ljr-btn-icon" onClick={onShare} aria-label="Share this league">
            <Share2 size={17} />
          </button>
        </div>
      </div>
    </article>
  );
};

const ArchiveRow = ({
  league,
  rank,
  onOpen,
}: {
  league: League;
  rank: number | null | undefined;
  onOpen: () => void;
}) => {
  const medal = rankMedal(rank);
  const players = playerCountLabel(league);
  return (
    <div
      className="ljr-arch-row"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className={`ljr-arch-medal${medal.className ? ` ${medal.className}` : ""}`}>{medal.emoji}</div>
      <div className="ljr-arch-main">
        <div className="ljr-arch-name">{league.name}</div>
        <div className="ljr-arch-sub">{[formatRange(league), players].filter(Boolean).join(" · ")}</div>
      </div>
      <div className="ljr-arch-result">
        <b>{medal.label}</b>
      </div>
    </div>
  );
};

const LeaguesPage = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const token = useMemo(
    () => resolveLeagueAuthToken({
      storedToken: getStoredAuthToken({ preferScheme: "token" }),
      user,
    }),
    [user],
  );
  const [topFilter, setTopFilter] = useState<BrowseTopFilter>("all");
  const [availableFilter, setAvailableFilter] =
    useState<LeagueBrowseAvailableFilter>("for-you");
  const [locationFilter, setLocationFilter] = useState("all");
  const [sections, setSections] = useState<LeagueSections>(EMPTY_SECTIONS);
  // Finished/past leagues split out of `mine` at load (see isPastLeague), surfaced
  // under Past seasons instead of active leagues.
  const [finishedMine, setFinishedMine] = useState<League[]>([]);
  const [profile, setProfile] = useState<PlayerPersonalDetails | null>(null);
  // Identity set for matching the viewer to their standings row — includes the fetched player
  // profile (its user_id/full_name align with the standings, unlike the thin auth `user`).
  const viewerIdentities = useMemo(() => buildViewerIdentities(user, profile), [user, profile]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinIntentLeagueId, setJoinIntentLeagueId] = useState<string | number | null>(null);
  const [pendingJoinRequest, setPendingJoinRequest] = useState<PendingLeagueJoinRequest | null>(null);
  const { openAuth } = useAuthDrawer();
  const [reviewLeagueId, setReviewLeagueId] = useState<string | number | null>(null);
  const [reviewProfile, setReviewProfile] = useState<PlayerPersonalDetails | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [joinStep, setJoinStep] = useState<JoinStep | null>(null);
  const [joinRule, setJoinRule] = useState<LeagueRuleVersion | null>(null);
  const [joinAgreement, setJoinAgreement] = useState<{
    signedName: string;
    rulesVersion: string;
  } | null>(null);
  const [joinResult, setJoinResult] = useState<LeagueEnrollmentResponse | null>(null);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<PlayerStripePaymentMethod[]>([]);
  const [joinFlowMessage, setJoinFlowMessage] = useState<string | null>(null);
  const [lookingCounts, setLookingCounts] = useState<Record<string, number>>({});
  const [archivedLoaded, setArchivedLoaded] = useState(false);
  // Per-enrolled-league enrichment (standings + unlogged fixtures), loaded async per card.
  const [mineEnrichment, setMineEnrichment] = useState<Record<string, MineEnrichment>>({});
  // Archive is collapsed by default; standings ranks are fetched only once it's expanded.
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [archiveListLoading, setArchiveListLoading] = useState(false);
  const [archiveRanks, setArchiveRanks] = useState<Record<string, number | null>>({});
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const leagueById = useMemo(() => {
    const entries = [...sections.mine, ...sections.available, ...sections.archived, ...finishedMine].map((league) => [
      String(league.id),
      league,
    ] as const);
    return new Map(entries);
  }, [sections.archived, sections.available, sections.mine, finishedMine]);

  // Past seasons = the backend's archived segment + finished leagues we pulled out
  // of `mine`, de-duped by id (backend entry wins).
  const pastSeasonLeagues = useMemo(() => {
    const ids = new Set(sections.archived.map((league) => String(league.id)));
    return [...sections.archived, ...finishedMine.filter((league) => !ids.has(String(league.id)))];
  }, [sections.archived, finishedMine]);

  const locationOptions = useMemo(() => {
    const areas = new Set<string>();
    [...sections.mine, ...sections.available, ...sections.archived].forEach((league) => {
      const area = typeof league.venue_area === "string" ? league.venue_area.trim() : "";
      if (area) areas.add(area);
    });
    return Array.from(areas).sort((left, right) => left.localeCompare(right));
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
    setJoinStep(null);
    setJoinAgreement(null);
    setJoinResult(null);
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

  const closeJoinFlow = () => {
    setReviewLeagueId(null);
    setJoinIntentLeagueId(null);
    setJoinStep(null);
    setJoinAgreement(null);
    setJoinResult(null);
  };

  const startAgreementStep = async (league: League, nextProfile: PlayerPersonalDetails) => {
    setReviewProfile(nextProfile);
    setReviewLoading(true);
    setReviewError(null);

    try {
      const [rulesResponse, paymentMethodsResponse] = await Promise.all([
        getLeagueRules({ leagueId: league.id, token }),
        token
          ? getPlayerStripePaymentMethods(token)
          : Promise.resolve([]),
      ]);
      const methods = Array.isArray(paymentMethodsResponse)
        ? paymentMethodsResponse
        : paymentMethodsResponse.payment_methods ?? paymentMethodsResponse.data ?? [];

      setJoinRule(rulesResponse.rule);
      setSavedPaymentMethods(methods);
      setJoinStep("agreement");
    } catch (error) {
      setReviewError(getApiErrorMessage(error));
    } finally {
      setReviewLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setArchivedLoaded(false);

    listLeagues({
      area: locationFilter === "all" ? undefined : locationFilter,
      token,
      signal: controller.signal,
    })
      .then((response) => {
        const nextSections = normalizeSections(response.sections);
        // Pull finished/past leagues out of `mine` so they show under Past seasons.
        setFinishedMine(nextSections.mine.filter(isPastLeague));
        setSections({
          mine: nextSections.mine.filter((league) => !isPastLeague(league)),
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
  }, [locationFilter, token, reloadKey]);

  useEffect(() => {
    // Load the archived list when its tab is active OR the collapsible archive is expanded.
    if ((topFilter !== "archived" && !archiveExpanded) || archivedLoaded) {
      return;
    }

    const controller = new AbortController();
    // Full-page loading only on the dedicated archived tab; expanding the collapsible archive
    // on the "all" view uses a local spinner so it never blanks the page.
    const dedicated = topFilter === "archived";
    if (dedicated) {
      setLoading(true);
      setError(null);
    } else {
      setArchiveListLoading(true);
    }

    listLeagues({
      segment: "archived",
      area: locationFilter === "all" ? undefined : locationFilter,
      token,
      signal: controller.signal,
    })
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
        if (dedicated) {
          setError(err instanceof Error ? err.message : "Failed to load archived leagues");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          if (dedicated) setLoading(false);
          else setArchiveListLoading(false);
        }
      });

    return () => controller.abort();
  }, [archivedLoaded, locationFilter, token, topFilter, archiveExpanded]);

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

  // Per-enrolled-league enrichment: standings (rank / of-N / matches / record) + the viewer's
  // pending fixtures (unlogged score). Runs AFTER the cards render — each card shows a skeleton
  // until its own request resolves, so the page never blocks on N requests.
  useEffect(() => {
    if (!token || sections.mine.length === 0) {
      setMineEnrichment({});
      return;
    }
    const controller = new AbortController();
    setMineEnrichment(() => {
      const init: Record<string, MineEnrichment> = {};
      sections.mine.forEach((league) => {
        init[String(league.id)] = { loading: true };
      });
      return init;
    });

    sections.mine.forEach(async (league) => {
      const id = String(league.id);
      try {
        // Standings gives rank/record; fixtures gives the viewer's real matches. Both the
        // fetch and the arithmetic now live in utils/leagueSeason so the home season module
        // counts this season exactly as this card does.
        const enrichment = await fetchSeasonEnrichment({
          leagueId: league.id,
          token,
          signal: controller.signal,
          viewerIdentities,
        });
        if (controller.signal.aborted) return;
        setMineEnrichment((current) => ({ ...current, [id]: enrichment }));
      } catch {
        if (controller.signal.aborted) return;
        setMineEnrichment((current) => ({ ...current, [id]: { loading: false, error: true } }));
      }
    });

    return () => controller.abort();
  }, [sections.mine, token, viewerIdentities]);

  // Archive final-standing ranks — fetched lazily, and only once the archive is expanded, so
  // the collapsed default costs zero extra requests.
  useEffect(() => {
    if (!archiveExpanded || !token || pastSeasonLeagues.length === 0) return;
    const controller = new AbortController();
    pastSeasonLeagues.forEach(async (league) => {
      const id = String(league.id);
      if (archiveRanks[id] !== undefined) return; // already resolved
      try {
        const res = await getLeagueStandings({ leagueId: league.id, token, signal: controller.signal });
        if (controller.signal.aborted) return;
        const standings: LeagueStanding[] = res.standings ?? [];
        const mineRow = standings.find((row) =>
          matchesViewer(viewerIdentities, row.player_id, row.full_name),
        );
        setArchiveRanks((current) => ({ ...current, [id]: mineRow?.rank ?? null }));
      } catch {
        if (!controller.signal.aborted) {
          setArchiveRanks((current) => ({ ...current, [id]: null }));
        }
      }
    });
    return () => controller.abort();
  }, [archiveExpanded, pastSeasonLeagues, token, viewerIdentities, archiveRanks]);

  const handleShareLeague = useCallback(async (league: League) => {
    const url = `${window.location.origin}${window.location.pathname}#/leagues/${league.id}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: league.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareToast("Link copied");
      window.setTimeout(() => setShareToast(null), 2000);
    } catch {
      // User dismissed the share sheet or clipboard was blocked — nothing to do.
    }
  }, []);

  const filteredAvailableLeagues = useMemo(
    () => filterAvailableLeagues(sections.available, availableFilter, profile),
    [availableFilter, profile, sections.available],
  );

  const emptyCopy = getEmptyCopy({ filter: topFilter, availableFilter, isAuthenticated });

  const reviewLeague = reviewLeagueId != null ? leagueById.get(String(reviewLeagueId)) ?? null : null;

  // Lock body scroll while the join flow (eligibility sheet or agreement/payment
  // steps) is open, otherwise the page behind the drawer scrolls.
  const joinFlowOpen = Boolean(reviewLeague);
  useEffect(() => {
    if (!joinFlowOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [joinFlowOpen]);

  const handleJoinRequest = (leagueId: League["id"]) => {
    setJoinFlowMessage(null);

    const result = requestLeagueJoin({
      isAuthenticated,
      leagueId,
    });

    if (result.action === "open_auth") {
      setPendingJoinRequest(result.pending);
      setJoinIntentLeagueId(leagueId);
      openAuth({
        mode: "signup",
        reason: "Sign in or create an account to review league eligibility and continue.",
        // Cleared only if they dismiss without authenticating; on success the resume
        // effect above consumes pendingJoinRequest to open league review.
        onDismiss: () => {
          setPendingJoinRequest(null);
          setJoinIntentLeagueId(null);
        },
      });
      return;
    }

    if (result.action === "open_review") {
      void openJoinReview(result.leagueId);
    }
  };

  // A league's own page hands the join off here (its detail view has no agreement/
  // payment steps), passing the league via router state so we open the full flow.
  const joinIntentHandledRef = useRef(false);
  useEffect(() => {
    if (joinIntentHandledRef.current) return;
    const navState = routerLocation.state as { openJoinLeagueId?: string | number } | null;
    if (navState?.openJoinLeagueId == null) return;
    joinIntentHandledRef.current = true;
    handleJoinRequest(navState.openJoinLeagueId);
    // Strip the state so a refresh / back-nav doesn't re-open the flow.
    navigate("/leagues", { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routerLocation.state]);

  const firstName =
    (profile?.full_name || (user as { full_name?: string } | null)?.full_name || "")
      .trim()
      .split(/\s+/)[0] || "there";

  // Count of enrolled leagues that need attention (unlogged score, or minimum-not-met while
  // players are looking). Updates as per-card enrichment resolves — never blocks render.
  const pendingCount = sections.mine.reduce((count, league) => {
    const enrichment = mineEnrichment[String(league.id)];
    if (!enrichment || enrichment.loading) return count;
    const looking = lookingCounts[String(league.id)] ?? 0;
    const met = computeSeasonProgress(enrichment.matchesPlayed ?? 0).met;
    if (!enrichment.preSeason && !met && looking > 0) return count + 1;
    return count;
  }, 0);

  const archivedGroups = groupArchivedBySeason(pastSeasonLeagues);

  return (
    <MainLayout pageClassName="leagues-shell" mobileChrome="home" hideMobileNewMatch>
      <div className="leagues-redesign tpl">
        <header className="ljr-hero-greet">
          <div>
            <h1>Your leagues{isAuthenticated ? `, ${firstName}` : ""}</h1>
            <p className="ljr-hero-sub">
              {/* Full sentence on larger screens; a condensed version on mobile
                  so the headline block doesn't push the cards down. */}
              <span className="ljr-hero-sub__full">
                {isAuthenticated && sections.mine.length > 0 ? (
                  <>
                    You&apos;re in <b>{sections.mine.length} league{sections.mine.length === 1 ? "" : "s"}</b> this season
                    {pendingCount > 0 ? (
                      <>
                        {" "}— <b>{pendingCount} thing{pendingCount === 1 ? "" : "s"}</b> need
                        {pendingCount === 1 ? "s" : ""} your attention.
                      </>
                    ) : (
                      <> — nothing needs your attention right now.</>
                    )}
                  </>
                ) : (
                  <>Find a flex league at your level and start playing on your own schedule.</>
                )}
              </span>
              <span className="ljr-hero-sub__compact">
                {isAuthenticated && sections.mine.length > 0 ? (
                  <>
                    <b>{sections.mine.length} league{sections.mine.length === 1 ? "" : "s"}</b>
                    {pendingCount > 0 ? (
                      <> · <b>{pendingCount}</b> need{pendingCount === 1 ? "s" : ""} attention</>
                    ) : (
                      <> · all caught up</>
                    )}
                  </>
                ) : (
                  <>Find a flex league at your level.</>
                )}
              </span>
            </p>
          </div>
          <button
            type="button"
            className="ljr-btn-primary"
            onClick={() =>
              document.getElementById("ljr-discover")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Find a new league ↓
          </button>
        </header>

        {joinFlowMessage ? (
          <div className="leagues-page__notice">
            <CircleAlert size={16} />
            {joinFlowMessage}
          </div>
        ) : null}

        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="leagues-page__state leagues-page__state--error">
            <span>{error}</span>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
              Retry
            </button>
          </div>
        ) : (
          <>
            {isAuthenticated && sections.mine.length > 0 ? (
              <section className="ljr-section" aria-label="Your leagues">
                <div className="ljr-section-head">
                  <h2>
                    Playing now <span className="ljr-count-pill">{sections.mine.length}</span>
                  </h2>
                </div>
                <div className="ljr-mine-grid">
                  {sections.mine.map((league) => (
                    <PlayingNowCard
                      key={`mine-${league.id}`}
                      league={league}
                      enrichment={mineEnrichment[String(league.id)]}
                      lookingCount={lookingCounts[String(league.id)] ?? 0}
                      onOpen={() => navigate(`/leagues/${league.id}/dashboard`)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="ljr-section" id="ljr-discover" aria-label="Open leagues near you">
              <div className="ljr-section-head">
                <h2>Open near you</h2>
              </div>
              <p className="ljr-discover-intro">
                Picked for your level and location. Seasons start soon — spots go quickly at 4.0 and up.
              </p>

              <div className="ljr-filter-row">
                {AVAILABLE_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    className={`ljr-chip${availableFilter === filter.value ? " is-on" : ""}`}
                    onClick={() => setAvailableFilter(filter.value)}
                  >
                    {filter.label}
                  </button>
                ))}
                {locationOptions.length > 0 ? (
                  <label className="ljr-chip ljr-chip-filter">
                    <MapPin size={14} />
                    <select
                      value={locationFilter}
                      onChange={(event) => setLocationFilter(event.target.value)}
                      aria-label="Filter by location"
                    >
                      <option value="all">All locations</option>
                      {locationOptions.map((area) => (
                        <option key={area} value={area}>
                          {area}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              {filteredAvailableLeagues.length > 0 ? (
                <div className="ljr-disc-grid">
                  {filteredAvailableLeagues.map((league) => (
                    <DiscoveryCard
                      key={`avail-${league.id}`}
                      league={league}
                      distanceLabel={formatDistanceMiles(leagueVenueDistanceMiles(league))}
                      priceLabel={priceLabel(league)}
                      onJoin={() => handleJoinRequest(league.id)}
                      onDetails={() => navigate(`/leagues/${league.id}`)}
                      onShare={() => void handleShareLeague(league)}
                    />
                  ))}
                </div>
              ) : (
                <div className="leagues-page__empty">
                  <Search size={28} />
                  <h2>{emptyCopy.title}</h2>
                  <p>{emptyCopy.body}</p>
                </div>
              )}
            </section>

            <footer className="ljr-past">
              <button
                type="button"
                onClick={() => setArchiveExpanded((open) => !open)}
                aria-expanded={archiveExpanded}
              >
                {archiveExpanded ? "Hide past seasons ↑" : "View past seasons →"}
              </button>
            </footer>

            {archiveExpanded ? (
              <section className="ljr-section ljr-archive" aria-label="Your past seasons">
                <div className="ljr-section-head">
                  <h2>Your seasons</h2>
                </div>
                {archiveListLoading && pastSeasonLeagues.length === 0 ? (
                  <p className="ljr-archive-loading">Loading past seasons…</p>
                ) : pastSeasonLeagues.length === 0 ? (
                  <SectionEmptyState
                    title="No past seasons yet"
                    body="Completed leagues will show here with your final standing."
                  />
                ) : (
                  archivedGroups.map(([label, leagues]) => (
                    <div className="ljr-season-group" key={label}>
                      <div className="ljr-season-title">{label}</div>
                      {leagues.map((league) => (
                        <ArchiveRow
                          key={`arch-${league.id}`}
                          league={league}
                          rank={archiveRanks[String(league.id)]}
                          onOpen={() => navigate(`/leagues/${league.id}/dashboard`)}
                        />
                      ))}
                    </div>
                  ))
                )}
              </section>
            ) : null}
          </>
        )}

        {shareToast ? (
          <div className="ljr-toast" role="status">
            {shareToast}
          </div>
        ) : null}

        {reviewLeague && !joinStep ? (
          <LeagueJoinReviewSheet
            league={reviewLeague}
            profile={reviewProfile}
            token={token}
            loading={reviewLoading}
            profileError={reviewError}
            onClose={closeJoinFlow}
            onEligible={(nextProfile) => {
              void startAgreementStep(reviewLeague, nextProfile);
            }}
          />
        ) : null}
        {reviewLeague && joinStep ? (
          <div className="league-join-sheet" role="dialog" aria-modal="true" aria-label="League join">
            <button
              type="button"
              className="league-join-sheet__backdrop"
              aria-label="Close league join"
              onClick={closeJoinFlow}
            />
            <div className="league-join-sheet__panel">
              <div className="ljr-modal-head">
                <div className="ljr-modal-summary">
                  <div className="ljr-modal-lvl">{levelChipLabel(reviewLeague)}</div>
                  <div className="ljr-modal-summary__text">
                    <b>{reviewLeague.name}</b>
                    <span>
                      {[formatRange(reviewLeague), getLeagueLocationLabel(reviewLeague), priceLabel(reviewLeague)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                </div>
                <div className="ljr-modal-steps">
                  {([["Eligibility", 1], ["Sign", 2], ["Pay", 3]] as const).map(([label, n]) => {
                    const current = joinStep === "agreement" ? 2 : joinStep === "payment" ? 3 : 4;
                    return (
                      <div
                        key={label}
                        className={`ljr-modal-st${n < current ? " is-done" : ""}${n === current ? " is-now" : ""}`}
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>
              </div>
              {joinStep === "agreement" ? (
                <LeagueAgreementStep
                  league={reviewLeague}
                  rule={joinRule}
                  defaultName={reviewProfile?.full_name ?? ""}
                  onBack={() => setJoinStep(null)}
                  onContinue={(agreement) => {
                    setJoinAgreement({
                      signedName: agreement.signedName,
                      rulesVersion: agreement.rulesVersion,
                    });
                    setJoinStep("payment");
                  }}
                />
              ) : null}
              {joinStep === "payment" && joinAgreement && token ? (
                <LeaguePaymentStep
                  league={reviewLeague}
                  token={token}
                  agreement={joinAgreement}
                  savedMethods={savedPaymentMethods}
                  onBack={() => setJoinStep("agreement")}
                  onSuccess={(result) => {
                    setJoinResult(result);
                    setJoinStep("success");
                  }}
                  onLeagueFull={() => {
                    setJoinFlowMessage("This league just filled - you were not charged.");
                    closeJoinFlow();
                  }}
                />
              ) : null}
              {joinStep === "success" && joinResult ? (
                <LeagueJoinSuccess
                  league={reviewLeague}
                  result={joinResult}
                  firstName={firstName !== "there" ? firstName : undefined}
                  onViewLeague={() => {
                    closeJoinFlow();
                    navigate(`/leagues/${reviewLeague.id}/dashboard`);
                  }}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </MainLayout>
  );
};

export default LeaguesPage;
