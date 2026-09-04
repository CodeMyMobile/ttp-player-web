import { useEffect, useMemo, useRef, useState } from "react";
import Autocomplete from "react-google-autocomplete";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Clock,
  Info,
  MapPin,
  Search,
  Share2,
  Star,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  Users,
  X,
} from "lucide-react";

import {
  type League,
  type LeagueCapacity,
  type LeagueDetailResponse,
  type LeagueFixture,
  type LeagueMatchNeed,
  type LeagueMatchSuggestion,
  type LeaguePlayer,
  type LeagueStanding,
  acceptLeagueMatchSuggestion,
  isLeagueSlotAvailable,
  acceptLeagueMatchNeedPreview,
  createLeagueMatchNeed,
  getLeagueDetail,
  getLeagueFixtures,
  getLeagueMatchNeeds,
  getLeaguePlayers,
  getLeagueStandings,
  previewLeagueMatchNeed,
  sendLeagueMatchNeedInvites,
} from "../api/leagues";
import { cancelHostedMatch, leaveMatch, listMatches } from "../api/matches";
import { buildGoogleCalendarUrl } from "../utils/googleCalendarLink";
import {
  buildScheduledLeagueMatches,
  type ScheduledLeagueMatch,
} from "../utils/scheduledLeagueMatches";
import { evaluateLeagueEligibility } from "../features/leagueJoin/eligibility";
import { getLeagueCapacity } from "./leagueBrowse";
import { leaguePhoto } from "../utils/leaguePhoto";
import { leagueVenueDistanceMiles, formatDistanceMiles } from "../utils/distance";
import "./leagueRedesign.tokens.css";
import type { PlayerPersonalDetails } from "../api/playerProfile";
import { getPlayerPersonalDetails } from "../api/playerProfile";
import { useAuthDrawer } from "../context/AuthDrawerContext";
import MainLayout from "../components/MainLayout";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";
import {
  DEFAULT_LEAGUE_TIMEZONE,
  formatLeagueDate as formatDate,
  formatLeagueTime as formatTime,
  isFutureLeagueItem,
} from "./leagueDetailTime";
import { getLeagueCardVariant } from "./leagueBrowse";
import { requiresLeagueAuthPrompt } from "./leagueAuthGate";
import {
  type LeagueLadderRow,
  buildLeagueChallengeState,
  buildLeagueLadderRows,
  buildSuggestedChallengeRows,
} from "./leagueLadder";
import { orientScore } from "./leagueScore";

import "./LeaguesPage.css";

type TabKey = "standings" | "players" | "results" | "pending" | "scheduled";
type NeedFlowStep = "idle" | "precheck" | "accept" | "invite";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "standings", label: "Standings" },
  { key: "players", label: "Ladder" },
  { key: "results", label: "Results" },
  { key: "scheduled", label: "Scheduled" },
  { key: "pending", label: "Pending" },
];


const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const formatTpr = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(3) : null;
};

// Backend returns 409 { error: "suggested_match_unavailable" } when a need has
// already been filled/confirmed by someone else.
const isMatchUnavailable = (err: unknown) => {
  const e = err as { status?: number; data?: { error?: string }; message?: string };
  return e?.status === 409
    || e?.data?.error === "suggested_match_unavailable"
    || e?.message === "suggested_match_unavailable";
};

const describeJoinError = (err: unknown) => {
  if (isMatchUnavailable(err)) return "This match is already full — it's no longer available.";
  const code = (err as { data?: { error?: string }; message?: string })?.data?.error;
  if (code === "cannot_accept_own_match_need") return "You can't join your own match need.";
  return err instanceof Error ? err.message : "Failed to join match.";
};

// Suggestion and need records are indexed as `[key: string]: unknown`, so a timestamp
// read off them arrives untyped. Narrow to the first usable string.
const pickFirstString = (...values: unknown[]): string =>
  values.find((value): value is string => typeof value === "string" && value.trim() !== "") ?? "";

// Addressing someone by first name reads as a message from a person, not a receipt.
const firstNameOf = (fullName: string) => fullName.trim().split(/\s+/)[0] || fullName;

const formatNeedSummary = (need?: LeagueMatchNeed | null) => {
  if (!need) return "Match need";
  const timezone = need.timezone || DEFAULT_LEAGUE_TIMEZONE;
  const date = formatDate(need.start_date_time, timezone);
  const time = formatTime(need.start_date_time, timezone);
  return `${date} · ${time} · ${need.location_text || "Location TBD"}`;
};

const getPendingOpponent = (fixture: LeagueFixture, userId?: number | string | null) => {
  if (String(fixture.player1_id) === String(userId)) return fixture.player2_name || "Opponent";
  if (String(fixture.player2_id) === String(userId)) return fixture.player1_name || "Opponent";
  return `${fixture.player1_name || "Player 1"} vs ${fixture.player2_name || "Player 2"}`;
};

const todayInputValue = () => new Date().toISOString().slice(0, 10);
const inviteMessageMaxLength = 160;
const defaultNeedLocation = {
  label: "Penmar Courts",
  latitude: 34.0066,
  longitude: -118.4556,
};

// Resolve a location string to coordinates via Google Geocoding. Used as a safety net so
// a match need is never posted with null lat/lng — which the backend treats as (0,0),
// producing the ~7,800-mile distances. Resolves null if geocoding is unavailable/fails.
const geocodeAddress = (
  address: string,
): Promise<{ latitude: number; longitude: number } | null> =>
  new Promise((resolve) => {
    if (!address || typeof google === "undefined" || !google?.maps?.Geocoder) {
      resolve(null);
      return;
    }
    try {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode(
        { address, componentRestrictions: { country: "us" } },
        (results, status) => {
          const location = results?.[0]?.geometry?.location;
          if (status === "OK" && location) {
            resolve({ latitude: location.lat(), longitude: location.lng() });
          } else {
            resolve(null);
          }
        },
      );
    } catch {
      resolve(null);
    }
  });

const buildInviteMessage = (need: LeagueMatchNeed | null, fallbackLocation: string) => {
  const location = need?.location_text || fallbackLocation;
  const timezone = need?.timezone || DEFAULT_LEAGUE_TIMEZONE;
  const message = `Hey, I'm looking for a match on ${formatDate(need?.start_date_time, timezone)} at ${formatTime(need?.start_date_time, timezone)} at ${location}. Let me know if you're interested!`;
  return message.length <= inviteMessageMaxLength ? message : `${message.slice(0, inviteMessageMaxLength - 3).trim()}...`;
};

const normalizeIdentity = (value: unknown) => String(value ?? "").trim().toLowerCase();

// ───────────────────────── Stage 3: public pre-join league page ─────────────────────────
const formatLeaguePrice = (league?: League | null): string | null => {
  if (!league || league.cost_cents == null || league.cost_cents === "") return null;
  const cents = Number(league.cost_cents);
  if (!Number.isFinite(cents)) return null;
  if (cents <= 0) return "Free";
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
};

const genderFlag = (gender?: string | null): string | null => {
  const g = typeof gender === "string" ? gender.toLowerCase() : "";
  if (g === "men") return "Men's";
  if (g === "women") return "Women's";
  if (g === "mixed") return "Mixed";
  return null;
};

const JoinPageSkeleton = () => (
  <div className="ljr-jp">
    <div className="ljr-jp-hero ljr-skel" style={{ height: 220, borderRadius: "0 0 26px 26px" }} />
    <div className="ljr-jp-body">
      <div className="ljr-skel" style={{ height: 26, width: "60%", margin: "18px 0" }} />
      <div className="ljr-skel" style={{ height: 80, borderRadius: 18 }} />
    </div>
  </div>
);

// The public pre-join league page — shown to logged-out and authed-but-not-enrolled viewers.
// Presentational: all data comes from the (public) league detail; the CTA calls back to the
// page's existing join launcher / auth gate.
const LeagueJoinPageView = ({
  league,
  capacity,
  eligibilityPass,
  distanceLabel,
  priceLabel,
  onBack,
  onShare,
  onJoin,
}: {
  league: League;
  capacity: LeagueCapacity | null;
  eligibilityPass: boolean | null; // true = green strip; null/false = neutral variant
  distanceLabel: string | null;
  priceLabel: string | null;
  onBack: () => void;
  onShare: () => void;
  onJoin: () => void;
}) => {
  const cap = capacity ?? getLeagueCapacity(league);
  const remaining = cap.remaining;
  const filled = cap.filled;
  const total = cap.total;
  const hot = remaining != null && remaining > 0 && remaining <= 3;
  const spotsFlag =
    remaining == null ? null : remaining > 0 ? `Only ${remaining} spot${remaining === 1 ? "" : "s"} left` : "Full";
  const level = typeof league.skill_band === "string" && league.skill_band.trim() ? league.skill_band.trim() : null;
  const gender = genderFlag(league.gender);
  const venue =
    league.venue_name ||
    [league.venue_area].filter(Boolean).join("") ||
    (typeof league.location === "string" ? league.location : "") ||
    "the league's home courts";
  const dateRange = [league.start_date, league.end_date]
    .filter(Boolean)
    .map((d) => formatDate(String(d)))
    .join(" – ");
  const capPct = total && total > 0 && filled != null ? Math.round((filled / total) * 100) : 0;
  const priceCopy = priceLabel ? `${priceLabel} · full season` : "Season entry";

  return (
    <div className="ljr-jp">
      <header className="ljr-jp-hero">
        <img src={leaguePhoto(league)} alt="" aria-hidden="true" />
        <button type="button" className="ljr-jp-circ ljr-jp-circ--l" onClick={onBack} aria-label="Back to leagues">
          <ChevronLeft size={18} />
        </button>
        <button type="button" className="ljr-jp-circ ljr-jp-circ--r" onClick={onShare} aria-label="Share this league">
          <Share2 size={16} />
        </button>
        {hot && spotsFlag ? <span className="ljr-jp-hot">{spotsFlag}</span> : null}
      </header>

      <div className="ljr-jp-body">
        <div className="ljr-jp-titleblock">
          <div className="ljr-jp-flags">
            {level ? <span className="ljr-jp-flag">{`NTRP ${level}`}</span> : null}
            {gender ? <span className="ljr-jp-flag">{gender}</span> : null}
          </div>
          <h1>{league.name}</h1>
          <div className="ljr-jp-sub">
            A season of matches on your schedule{dateRange ? ` · ${dateRange}` : ""}
          </div>
        </div>

        <div className="ljr-jp-specband">
          <div className="ljr-jp-spec-item">
            <CalendarDays size={16} />
            <div>
              <div className="k">Season</div>
              <div className="v">{dateRange || "Dates TBD"}</div>
            </div>
          </div>
          <div className="ljr-jp-spec-item">
            <MapPin size={16} />
            <div>
              <div className="k">Courts</div>
              <div className="v">{[venue, distanceLabel].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
          <div className="ljr-jp-spec-item">
            <Clock size={16} />
            <div>
              <div className="k">Pace</div>
              <div className="v">Min 6 matches · you pick when</div>
            </div>
          </div>
          <div className="ljr-jp-spec-item">
            <Star size={16} />
            <div>
              <div className="k">Entry</div>
              <div className="v">{priceCopy}</div>
            </div>
          </div>
        </div>

        <section className="ljr-jp-section">
          <h2>How a flex league works</h2>
          <p className="ljr-jp-lede">No fixed match nights — you play when it suits you.</p>
          <div className="ljr-jp-card ljr-jp-how">
            <div className="ljr-jp-how-step">
              <span className="ljr-jp-how-num">1</span>
              <div>
                <b>Post when you can play</b>
                <p>Put up your availability whenever you want a match — an evening, a weekend morning, whatever works.</p>
              </div>
            </div>
            <div className="ljr-jp-how-step">
              <span className="ljr-jp-how-num">2</span>
              <div>
                <b>Match with players in the league</b>
                <p>Other players see you&apos;re looking and respond — or you jump on their posts. You arrange the time and court between you.</p>
              </div>
            </div>
            <div className="ljr-jp-how-step">
              <span className="ljr-jp-how-num">3</span>
              <div>
                <b>Log scores, climb the standings</b>
                <p>Play at least 6 matches over the season. Every result updates the standings and your rating.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="ljr-jp-section">
          <h2>Who you&apos;ll play</h2>
          <p className="ljr-jp-lede">
            Real matches, not blowouts{level ? ` — everyone's inside the ${level} band` : ""}.
          </p>
          <div className="ljr-jp-card">
            <div className="ljr-jp-wholine">
              {filled != null ? <b>{filled} players in</b> : <b>Open for players</b>} — every player passed the same
              level check you will.
            </div>
            {total != null ? (
              <>
                <div className="ljr-jp-capline">
                  <span>
                    {filled ?? 0} of {total} spots filled
                  </span>
                  {remaining != null && remaining > 0 ? (
                    <span className="ljr-jp-warnpill">{remaining} left</span>
                  ) : null}
                </div>
                <div className="ljr-jp-captrack">
                  <div className="ljr-jp-capfill" style={{ width: `${capPct}%` }} />
                </div>
              </>
            ) : null}
          </div>
        </section>

        <section className="ljr-jp-section">
          <h2>Where you&apos;ll play</h2>
          <div className="ljr-jp-card ljr-jp-where">
            <p>
              <b>{venue}</b>
              {distanceLabel ? <> — <b>{distanceLabel} from you.</b></> : "."} You and your opponent pick the court
              that suits you both; this is the league&apos;s home base.
            </p>
            <div className="ljr-jp-map">Map — {venue}</div>
          </div>
        </section>

        <section className="ljr-jp-section">
          <h2>Good to know</h2>
          <details>
            <summary>What if I&apos;m away for a week or two?</summary>
            <div className="ljr-jp-a">No problem — there&apos;s no weekly fixture to miss. You post availability when you&apos;re around and play more in the weeks you&apos;re free. You just need your 6 matches in by the end of the season.</div>
          </details>
          <details>
            <summary>How do I find opponents?</summary>
            <div className="ljr-jp-a">Post your availability in the league and other players respond, or browse who&apos;s looking and jump on their posts. Most players in an active league find a match within a couple of days.</div>
          </details>
          <details>
            <summary>Who pays for courts?</summary>
            <div className="ljr-jp-a">Court fees are split between the two players. You choose the court together when you arrange the match.</div>
          </details>
          <details>
            <summary>Can I get a refund if I change my mind?</summary>
            <div className="ljr-jp-a">Full refund up to the day the season starts. After the season begins, entry is non-refundable — your spot has taken someone else&apos;s place.</div>
          </details>
          <details>
            <summary>Is my level right for this league?</summary>
            <div className="ljr-jp-a">If your NTRP is {level || "in band"}, yes. Your profile rating is checked automatically when you join — and your results will settle you at the right level fast.</div>
          </details>

          {eligibilityPass ? (
            <div className="ljr-jp-elig is-pass">
              <Check size={16} />
              <span>Your profile matches this league. Joining takes about a minute.</span>
            </div>
          ) : (
            <div className="ljr-jp-elig">
              <Info size={16} />
              <span>
                This league needs {[level ? `NTRP ${level}` : null, gender, "18+"].filter(Boolean).join(", ")} — we&apos;ll
                check your profile when you join.
              </span>
            </div>
          )}
        </section>
      </div>

      <div className="ljr-jp-sticky">
        <div className="ljr-jp-sticky-inner">
          <div className="ljr-jp-bar-info">
            <b>{priceCopy}</b>
            {hot && spotsFlag ? <span>{spotsFlag}</span> : null}
          </div>
          <button type="button" className="ljr-jp-cta" onClick={onJoin}>
            Join this league
          </button>
        </div>
      </div>
    </div>
  );
};

const LeagueDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const navStateHandledRef = useRef(false);
  const pendingAuthActionRef = useRef<(() => void) | null>(null);
  // When another page (e.g. the dashboard) hands off here to open a drawer, it can
  // pass a `returnTo` path so closing the drawer routes back there instead of
  // stranding the user on this page.
  const returnToRef = useRef<string | null>(null);
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
  const userId = user?.id ?? user?.user_id ?? user?.player_id ?? user?.profile?.id ?? user?.profile?.user_id;
  const currentUserIdentities = useMemo(() => new Set([
    normalizeIdentity(userId),
    normalizeIdentity(user?.email),
    normalizeIdentity(user?.profile?.email),
    normalizeIdentity(user?.full_name),
    normalizeIdentity(user?.profile?.full_name),
    normalizeIdentity(user?.name),
  ].filter(Boolean)), [user, userId]);

  const [activeTab, setActiveTab] = useState<TabKey>("standings");
  const [resultFilter, setResultFilter] = useState<"all" | "mine">("all");
  const [resultSort, setResultSort] = useState<"newest" | "oldest">("newest");
  // Clicking a match need previews it here; joining is an explicit confirm (no auto-join).
  const [confirmAccept, setConfirmAccept] = useState<{
    type: "suggestion" | "need";
    id: number | string;
    name: string;
    when?: string;
    location?: string | null;
    /** Raw ISO start, kept alongside the formatted `when` for the calendar link. */
    startDateTime?: string | null;
  } | null>(null);
  // Shown after a successful accept: what was agreed, and the two things that actually
  // get the match played — message your opponent, and put it in your calendar.
  const [acceptedMatch, setAcceptedMatch] = useState<{
    name: string;
    when?: string;
    location: string | null;
    startDateTime: string | null;
  } | null>(null);
  // Cancelling notifies the other player, so it gets a confirm step rather than firing
  // straight off a row button.
  const [confirmCancel, setConfirmCancel] = useState<ScheduledLeagueMatch | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [standings, setStandings] = useState<LeagueStanding[]>([]);
  const [players, setPlayers] = useState<LeaguePlayer[]>([]);
  const [ladderSearch, setLadderSearch] = useState("");
  const [selectedLadderPlayerId, setSelectedLadderPlayerId] = useState<string | null>(null);
  const [results, setResults] = useState<LeagueFixture[]>([]);
  const [pending, setPending] = useState<LeagueFixture[]>([]);
  const [matchNeeds, setMatchNeeds] = useState<LeagueMatchNeed[]>([]);
  const [allNeeds, setAllNeeds] = useState<LeagueMatchNeed[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledLeagueMatch[]>([]);
  const [suggestions, setSuggestions] = useState<LeagueMatchSuggestion[]>([]);
  const [needFlowStep, setNeedFlowStep] = useState<NeedFlowStep>("idle");
  const [postedNeed, setPostedNeed] = useState<LeagueMatchNeed | null>(null);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<number | string | null>(null);
  const [acceptMessage, setAcceptMessage] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [selectedInviteIds, setSelectedInviteIds] = useState<Array<number | string>>([]);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Stage 3: public league detail (works for guests + authed non-members) drives the pre-join
  // page and the enrolled-vs-not decision. previewProfile powers the eligibility strip.
  const [detail, setDetail] = useState<LeagueDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [previewProfile, setPreviewProfile] = useState<PlayerPersonalDetails | null>(null);
  const [isNeedDrawerOpen, setNeedDrawerOpen] = useState(false);
  const [needDate, setNeedDate] = useState(todayInputValue);
  const [needTime, setNeedTime] = useState("");
  const [needLocation, setNeedLocation] = useState(defaultNeedLocation.label);
  const [needLatitude, setNeedLatitude] = useState<number | null>(defaultNeedLocation.latitude);
  const [needLongitude, setNeedLongitude] = useState<number | null>(defaultNeedLocation.longitude);
  const [shareWithLeagueOnly, setShareWithLeagueOnly] = useState(true);
  const [needSubmitting, setNeedSubmitting] = useState(false);
  const [needError, setNeedError] = useState<string | null>(null);
  const { openAuth } = useAuthDrawer();
  const openJoinReview = (leagueId: League["id"]) => {
    if (!leagueId) return;
    // The detail page has no agreement/payment steps — hand off to the /leagues
    // browse flow, which runs eligibility → agreement → payment for this league.
    navigate("/leagues", { state: { openJoinLeagueId: leagueId } });
  };

  const requireLeagueAuth = (action?: () => void) => {
    if (!requiresLeagueAuthPrompt(isAuthenticated)) {
      action?.();
      return true;
    }
    pendingAuthActionRef.current = action ?? null;
    openAuth({
      mode: "signup",
      reason: "Sign in or create an account to post availability, join matches, and submit scores.",
      // On success, run the action they were attempting; on dismiss, drop it.
      onSuccess: () => {
        const pending = pendingAuthActionRef.current;
        pendingAuthActionRef.current = null;
        pending?.();
      },
      onDismiss: () => {
        pendingAuthActionRef.current = null;
      },
    });
    return false;
  };

  const navigateWithLeagueAuth = (to: string, state?: Record<string, unknown>) => {
    requireLeagueAuth(() => navigate(to, state ? { state } : undefined));
  };

  // Membership: derived from the public detail. null while it loads.
  const isMember = useMemo<boolean | null>(() => {
    if (!detail) return null;
    const status =
      typeof detail.membership_state?.status === "string"
        ? detail.membership_state.status.toLowerCase()
        : "";
    if (status && status !== "none") return true;
    if (detail.membership_state?.joined_via) return true;
    return detail.league ? getLeagueCardVariant(detail.league) === "enrolled" : false;
  }, [detail]);

  // Public detail fetch — guests + authed. Same resource as the public /leagues list, so it
  // works for shared /leagues/:id deep links. Seeds `league` so the join CTA / review sheet
  // have it even before the (member-only) heavy fetch runs.
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setDetailLoading(true);
    getLeagueDetail({ leagueId: id, token, signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        setDetail(response);
        setLeague((current) => current ?? response.league);
      })
      .catch(() => {
        // Non-fatal: the pre-join page falls back to generic copy.
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [id, token]);

  // Profile for the eligibility strip (authed viewers only; guests get the neutral variant).
  useEffect(() => {
    if (!token) {
      setPreviewProfile(null);
      return;
    }
    const controller = new AbortController();
    getPlayerPersonalDetails({ token, signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) setPreviewProfile(response);
      })
      .catch(() => {
        if (!controller.signal.aborted) setPreviewProfile(null);
      });
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    // Heavy, member-only detail (standings/players/fixtures/needs). Guests and authed
    // non-members get the pre-join page instead, so skip these auth-only calls for them.
    if (!id || !isAuthenticated || isMember !== true) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const venueLat = Number(detail?.league?.venue_latitude);
    const venueLng = Number(detail?.league?.venue_longitude);
    const hasVenueCoordinates = Number.isFinite(venueLat) && Number.isFinite(venueLng);

    Promise.all([
      getLeagueStandings({ leagueId: id, token, signal: controller.signal }),
      getLeaguePlayers({
        leagueId: id,
        token,
        ratedOnly: true,
        sort: "rating",
        nearLat: hasVenueCoordinates ? venueLat : undefined,
        nearLng: hasVenueCoordinates ? venueLng : undefined,
        radiusMiles: hasVenueCoordinates ? 10 : undefined,
        signal: controller.signal,
      }),
      getLeagueFixtures({ leagueId: id, token, status: "confirmed", signal: controller.signal }),
      getLeagueFixtures({ leagueId: id, token, status: "scheduled", mine: true, signal: controller.signal }),
      getLeagueMatchNeeds({ leagueId: id, token, signal: controller.signal }),
      getLeagueMatchNeeds({ leagueId: id, token, scope: "all", signal: controller.signal }),
    ])
      .then(([standingsResponse, playersResponse, resultsResponse, pendingResponse, needsResponse, allNeedsResponse]) => {
        const standingsPlayers = (standingsResponse.standings ?? []).map((row) => ({
          player_id: row.player_id,
          full_name: row.full_name,
          current_rating: row.current_rating,
          usta_rating: row.usta_rating,
          uta_rating: row.uta_rating,
          calculated_ntrp: row.calculated_ntrp,
          calculated_utr: row.calculated_utr,
          is_estimate: row.is_estimate,
          rating_gender: row.rating_gender,
          matches_played: row.matches_played,
          rating_source: row.matches_played > 0 ? "results" : row.is_estimate ? "self_rated" : null,
        }));
        setLeague(standingsResponse.league ?? playersResponse.league);
        setStandings(standingsResponse.standings ?? []);
        setPlayers((playersResponse.players?.length ? playersResponse.players : standingsPlayers) as LeaguePlayer[]);
        setResults(resultsResponse.fixtures ?? []);
        setPending(pendingResponse.fixtures ?? []);
        setMatchNeeds(needsResponse.myNeeds ?? []);
        setSuggestions(needsResponse.suggestions ?? []);
        // Full open-need count for the "See all (N)" preview link (browse lives on MatchBrowserPage).
        setAllNeeds(allNeedsResponse.needs ?? []);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load league");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id, token, isAuthenticated, isMember, detail?.league?.venue_latitude, detail?.league?.venue_longitude]);

  // Scheduled matches come from the general matches list rather than any league
  // endpoint — see utils/scheduledLeagueMatches for why. Kept out of the main
  // Promise.all so accepting a need can refresh just this list without refetching
  // standings, players, results and fixtures alongside it.
  const loadScheduled = useMemo(
    () => async (signal?: AbortSignal) => {
      if (!token || !id) {
        setScheduled([]);
        return;
      }
      try {
        const { matches } = await listMatches({
          token,
          filter: "my",
          status: "confirmed",
          signal,
        });
        if (signal?.aborted) return;
        setScheduled(buildScheduledLeagueMatches({ matches, leagueId: id, viewerId: userId }));
      } catch {
        // A scheduling list that fails to load must not take the league page with it —
        // the tab renders its own empty state.
        if (!signal?.aborted) setScheduled([]);
      }
    },
    [token, id, userId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadScheduled(controller.signal);
    return () => controller.abort();
  }, [loadScheduled]);

  const pendingCount = pending.length;
  const filteredResults = useMemo(() => {
    const list = results.filter((fixture) => {
      if (resultFilter !== "mine") return true;
      return String(fixture.player1_id) === String(userId) || String(fixture.player2_id) === String(userId);
    });
    return [...list].sort((a, b) => {
      const aDate = new Date(a.played_date || 0).getTime();
      const bDate = new Date(b.played_date || 0).getTime();
      return resultSort === "newest" ? bDate - aDate : aDate - bDate;
    });
  }, [results, resultFilter, resultSort, userId]);
  // W-L record lookup (from standings) + TPR lookup (from players) by player id —
  // fixtures/suggestions don't carry win/loss or rating.
  const standingsByPlayer = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number }>();
    standings.forEach((row) => map.set(String(row.player_id), { wins: row.wins, losses: row.losses }));
    return map;
  }, [standings]);
  const ladderRows = useMemo(
    () => buildLeagueLadderRows({ players, standings, viewerId: userId, search: ladderSearch }),
    [players, standings, userId, ladderSearch],
  );
  const suggestedLadderRows = useMemo(
    () => buildSuggestedChallengeRows(ladderRows, userId, 3),
    [ladderRows, userId],
  );
  const selectedLadderPlayer = useMemo(
    () => ladderRows.find((row) => row.playerId === selectedLadderPlayerId) ?? suggestedLadderRows[0] ?? ladderRows[0] ?? null,
    [ladderRows, selectedLadderPlayerId, suggestedLadderRows],
  );
  const futureSuggestions = useMemo(() => suggestions.filter(isFutureLeagueItem), [suggestions]);
  const futureNeeds = useMemo(() => allNeeds.filter(isFutureLeagueItem), [allNeeds]);
  const allNeedsCount = futureNeeds.length;
  // Compact "Players looking" preview: prefer personalized suggestions, else the
  // open needs (who's actually looking) — future-only, matching the "N looking" badge.
  const lookingPreview = useMemo(() => {
    const items = futureSuggestions.length
      ? futureSuggestions.map((s) => ({
          key: `s-${s.id}`, id: s.id, type: "suggestion" as const,
          name: s.player_name || "League player",
          tpr: formatTpr(s.player_skill),
          when: `${formatDate(s.match_date, s.timezone)} · ${formatTime(s.match_time, s.timezone)}`,
          location: s.match_location || null,
          playerId: s.suggested_player_id,
          playedBefore: s.has_played_before,
          available: isLeagueSlotAvailable(s),
        }))
      : futureNeeds.map((n) => ({
          key: `n-${n.id}`, id: n.id, type: "need" as const,
          name: n.player_name || "League player",
          tpr: formatTpr(n.player_skill),
          when: `${formatDate(n.start_date_time, n.timezone)} · ${formatTime(n.start_date_time, n.timezone)}`,
          location: n.match_location || n.location || n.location_text || null,
          playerId: n.player_id ?? n.host_id,
          playedBefore: n.has_played_before,
          available: isLeagueSlotAvailable(n),
        }));
    return items.slice(0, 3);
  }, [futureSuggestions, futureNeeds]);
  const selectedSuggestion = suggestions.find((suggestion) => suggestion.id === selectedSuggestionId) ?? suggestions[0];
  const invitePlayers = players.filter((player) => {
    const playerIdentities = [
      normalizeIdentity(player.player_id),
      normalizeIdentity(player.email),
      normalizeIdentity(player.full_name),
    ].filter(Boolean);
    return !playerIdentities.some((identity) => currentUserIdentities.has(identity));
  });
  const showNeedFlow = !loading && !error && needFlowStep !== "idle";

  const openNeedDrawer = () => {
    setNeedDrawerOpen(true);
    setNeedError(null);
  };

  // Pending-fixture "Quick Invite": open the Need-a-Match drawer and pre-select the
  // opponent so they're already checked when the flow reaches the invite step.
  const quickInvite = (fixture: LeagueFixture) => {
    requireLeagueAuth(() => {
      const opponentId = String(fixture.player1_id) === String(userId) ? fixture.player2_id : fixture.player1_id;
      setSelectedInviteIds(opponentId != null ? [opponentId] : []);
      openNeedDrawer();
    });
  };

  const challengeLadderPlayer = (row: LeagueLadderRow) => {
    requireLeagueAuth(() => {
      navigate("/matches/create", {
        state: buildLeagueChallengeState({
          row,
          leagueName: league?.name,
        }),
      });
    });
  };

  const returnToNeedForm = () => {
    setNeedFlowStep("idle");
    setNeedDrawerOpen(true);
    setNeedError(null);
  };

  // Coordinates for the need: prefer coords captured from a selected place, then the
  // default court, then a geocode of the current location text. onChange nulls the coords
  // whenever the text changes (so stale coords never survive an edit), and this recovers
  // them at submit — closing the race where onChange clobbered onPlaceSelected's coords.
  const resolveNeedCoords = async (): Promise<{
    latitude: number | null;
    longitude: number | null;
  }> => {
    if (needLatitude != null && needLongitude != null) {
      return { latitude: needLatitude, longitude: needLongitude };
    }
    if (normalizeIdentity(needLocation) === normalizeIdentity(defaultNeedLocation.label)) {
      return { latitude: defaultNeedLocation.latitude, longitude: defaultNeedLocation.longitude };
    }
    const geo = await geocodeAddress(needLocation);
    return { latitude: geo?.latitude ?? null, longitude: geo?.longitude ?? null };
  };

  const buildNeedPayload = async () => {
    const { latitude, longitude } = await resolveNeedCoords();
    return {
      date: needDate,
      time: needTime,
      location: needLocation,
      latitude,
      longitude,
      visibility: shareWithLeagueOnly ? ("league" as const) : ("open" as const),
      timezone: "America/Los_Angeles",
    };
  };

  const handlePreviewNeed = async () => {
    if (!id) return;
    setNeedSubmitting(true);
    setNeedError(null);
    setPostedNeed(null);
    try {
      const body = await buildNeedPayload();
      if (body.latitude == null || body.longitude == null) {
        setNeedError("We couldn't pin that location. Please pick a suggestion from the dropdown.");
        return;
      }
      const response = await previewLeagueMatchNeed({
        leagueId: id,
        token,
        body,
      });
      const nextSuggestions = response.suggestions ?? [];
      setPostedNeed(response.draft);
      setSuggestions(nextSuggestions);
      setSelectedSuggestionId(nextSuggestions[0]?.id ?? null);
      setAcceptMessage("");
      setNeedDrawerOpen(false);
      setNeedFlowStep("precheck");
    } catch (err) {
      setNeedError(err instanceof Error ? err.message : "Failed to check existing matches");
    } finally {
      setNeedSubmitting(false);
    }
  };

  const handleNeedPlaceSelected = (place: google.maps.places.PlaceResult | null) => {
    const latitude = place?.geometry?.location?.lat?.();
    const longitude = place?.geometry?.location?.lng?.();
    const label = place?.formatted_address || place?.name || needLocation;

    if (label) setNeedLocation(label);
    if (typeof latitude === "number" && Number.isFinite(latitude)) setNeedLatitude(latitude);
    if (typeof longitude === "number" && Number.isFinite(longitude)) setNeedLongitude(longitude);
  };

  const handleAcceptSuggestion = async (suggestionId: number | string) => {
    setNeedSubmitting(true);
    setNeedError(null);
    try {
      const suggestion = suggestions.find((item) => String(item.id) === String(suggestionId));
      if (postedNeed?.id && !String(suggestionId).startsWith("preview-")) {
        await acceptLeagueMatchSuggestion({ suggestionId, token });
      } else if (id && suggestion?.suggested_match_id) {
        await acceptLeagueMatchNeedPreview({
          leagueId: id,
          suggestedMatchId: suggestion.suggested_match_id,
          token,
          message: acceptMessage,
        });
      } else {
        throw new Error("Missing match suggestion");
      }
      setSuggestions((current) => current.filter((item) => item.id !== suggestionId));
      if (postedNeed?.id) {
        setMatchNeeds((current) => current.filter((need) => String(need.id) !== String(postedNeed.id)));
      }
      setPostedNeed(null);
      setNeedFlowStep("idle");
      // Scheduled, not Pending. Pending reads league fixtures, which are admin-generated
      // and never contain a scheduling match — sending the player there after accepting
      // showed them an unrelated list and made the accept look like it had failed.
      setActiveTab("scheduled");
      void loadScheduled();
      return true;
    } catch (err) {
      setNeedError(describeJoinError(err));
      // If it's already taken, drop the stale suggestion so it disappears.
      if (isMatchUnavailable(err)) {
        setSuggestions((current) => current.filter((item) => String(item.id) !== String(suggestionId)));
      }
      return false;
    } finally {
      setNeedSubmitting(false);
    }
  };

  const handleAcceptOpenNeed = async (needId: number | string) => {
    if (!id) return;
    setNeedSubmitting(true);
    setNeedError(null);
    try {
      await acceptLeagueMatchNeedPreview({
        leagueId: id,
        suggestedMatchId: needId,
        token,
        message: acceptMessage,
      });
      setAllNeeds((current) => current.filter((need) => String(need.id) !== String(needId)));
      setSuggestions((current) => current.filter((item) => String(item.suggested_match_id) !== String(needId)));
      setNeedFlowStep("idle");
      // See the note in handleAcceptSuggestion — Pending cannot show a scheduling match.
      setActiveTab("scheduled");
      void loadScheduled();
      return true;
    } catch (err) {
      setNeedError(describeJoinError(err));
      if (isMatchUnavailable(err)) {
        setAllNeeds((current) => current.filter((need) => String(need.id) !== String(needId)));
        setSuggestions((current) => current.filter((item) => String(item.suggested_match_id) !== String(needId)));
      }
      return false;
    } finally {
      setNeedSubmitting(false);
    }
  };

  // Open the confirm preview for a clicked need/suggestion (no auto-join).
  const previewAccept = (type: "suggestion" | "need", itemId: number | string) => {
    requireLeagueAuth(() => {
      if (type === "suggestion") {
        const s = suggestions.find((x) => String(x.id) === String(itemId));
        setConfirmAccept({
          type,
          id: itemId,
          name: s?.player_name || "League player",
          when: s ? `${formatDate(s.match_date, s.timezone)} · ${formatTime(s.match_time, s.timezone)}` : undefined,
          location: s?.match_location ?? null,
          startDateTime: pickFirstString(s?.match_start_date_time, s?.start_date_time) || null,
        });
      } else {
        const n = allNeeds.find((x) => String(x.id) === String(itemId));
        setConfirmAccept({
          type,
          id: itemId,
          name: n?.player_name || "League player",
          when: n ? `${formatDate(n.start_date_time, n.timezone)} · ${formatTime(n.start_date_time, n.timezone)}` : undefined,
          location: n?.match_location ?? n?.location ?? n?.location_text ?? null,
          startDateTime: pickFirstString(n?.start_date_time) || null,
        });
      }
    });
  };

  // Explicit join — only fires from the confirm dialog's "Request match" button.
  const acceptedCalendarUrl = acceptedMatch
    ? buildGoogleCalendarUrl({
        title: `Tennis match vs ${acceptedMatch.name}`,
        startDateTime: acceptedMatch.startDateTime,
        location: acceptedMatch.location,
        details: league?.name ? `${league.name} — league match` : "League match",
      })
    : null;

  // The host cancels the match outright; a player who accepted withdraws from it.
  // Both notify the other side — see the wrappers in api/matches.
  const cancelScheduled = async () => {
    if (!confirmCancel) return;
    setCancelSubmitting(true);
    setCancelError(null);
    try {
      if (confirmCancel.viewerIsHost) {
        await cancelHostedMatch({ matchId: confirmCancel.id, token });
      } else {
        await leaveMatch({ matchId: confirmCancel.id, token });
      }
      setScheduled((current) => current.filter((item) => String(item.id) !== String(confirmCancel.id)));
      setConfirmCancel(null);
      void loadScheduled();
    } catch (err) {
      // Keep the dialog open so the message is attached to the thing that failed.
      setCancelError(err instanceof Error ? err.message : "Couldn't cancel this match.");
    } finally {
      setCancelSubmitting(false);
    }
  };

  const requestMatch = async () => {
    if (!confirmAccept) return;
    const { type, id: acceptId } = confirmAccept;
    // Captured before the accept clears it — the success dialog needs the same details.
    const accepted = confirmAccept;
    const ok = type === "suggestion"
      ? await handleAcceptSuggestion(acceptId)
      : await handleAcceptOpenNeed(acceptId);
    if (ok) {
      setConfirmAccept(null); // on failure keep the dialog open so the error shows
      setAcceptedMatch({
        name: accepted.name,
        when: accepted.when,
        location: accepted.location ?? null,
        startDateTime: accepted.startDateTime ?? null,
      });
    }
  };

  // MatchBrowserPage hands off posting/connecting via router state. Posting opens the
  // drawer; a clicked need/suggestion opens the confirm preview — never auto-joins.
  useEffect(() => {
    if (loading || navStateHandledRef.current) return;
    const navState = routerLocation.state as
      | { openPost?: boolean; acceptSuggestionId?: number | string; acceptNeedId?: number | string; returnTo?: string }
      | null;
    if (!navState) return;
    navStateHandledRef.current = true;
    returnToRef.current = navState.returnTo ?? null;
    if (navState.openPost) {
      requireLeagueAuth(openNeedDrawer);
    } else if (navState.acceptSuggestionId != null) {
      previewAccept("suggestion", navState.acceptSuggestionId);
    } else if (navState.acceptNeedId != null) {
      previewAccept("need", navState.acceptNeedId);
    }
    navigate(`/leagues/${id}`, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, routerLocation.state]);

  // Lock body scroll while the bottom-sheet drawer is open, otherwise scrolling
  // the sheet chains through to the page behind it (you can't reach the fields).
  useEffect(() => {
    if (!isNeedDrawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isNeedDrawerOpen]);

  const handlePostAnyway = async () => {
    if (!id) return;
    setNeedSubmitting(true);
    setInviteError(null);
    setNeedError(null);
    try {
      const body = await buildNeedPayload();
      if (body.latitude == null || body.longitude == null) {
        setNeedError("We couldn't pin that location. Please pick a suggestion from the dropdown.");
        return;
      }
      const response = await createLeagueMatchNeed({
        leagueId: id,
        token,
        body,
      });
      setPostedNeed(response.match);
      setMatchNeeds((current) => [response.match, ...current]);
      setSelectedInviteIds(invitePlayers.slice(0, 1).map((player) => player.player_id));
      setInviteMessage(buildInviteMessage(response.match, needLocation));
      setNeedFlowStep("invite");
    } catch (err) {
      setNeedError(err instanceof Error ? err.message : "Failed to post match need");
    } finally {
      setNeedSubmitting(false);
    }
  };

  const handleSendInvites = async () => {
    if (!id || !postedNeed) return;
    if (inviteMessage.length > inviteMessageMaxLength) {
      setInviteError(`Message must be ${inviteMessageMaxLength} characters or fewer.`);
      return;
    }
    setInviteSubmitting(true);
    setInviteError(null);
    try {
      await sendLeagueMatchNeedInvites({
        leagueId: id,
        matchId: postedNeed.id,
        token,
        body: {
          player_ids: selectedInviteIds,
          message: inviteMessage,
        },
      });
      setNeedFlowStep("idle");
      setActiveTab("pending");
    } catch (err) {
      const data = (err as { data?: { error?: string; maxLength?: number } })?.data;
      if (data?.error === "message_too_long") {
        setInviteError(`Message must be ${data.maxLength || inviteMessageMaxLength} characters or fewer.`);
      } else if (data?.error === "no_invitees") {
        setInviteError("Choose at least one league player to invite.");
      } else {
        setInviteError(err instanceof Error ? err.message : "Failed to send invites");
      }
    } finally {
      setInviteSubmitting(false);
    }
  };


  // ---------- Stage 3: pre-join page for guests + authed non-members ----------
  if (isMember !== true) {
    const previewLeague = detail?.league ?? league;
    if (!previewLeague || (detailLoading && !detail)) {
      return (
        <MainLayout pageClassName="leagues-shell" hideMobileNewMatch>
          <div className="leagues-redesign tpl">
            <JoinPageSkeleton />
          </div>
        </MainLayout>
      );
    }

    const eligibilityPass: boolean | null = (() => {
      if (!isAuthenticated || !previewProfile) return null;
      const result = evaluateLeagueEligibility({
        league: previewLeague as Parameters<typeof evaluateLeagueEligibility>[0]["league"],
        profile: {
          gender: previewProfile.gender,
          usta_rating: previewProfile.usta_rating,
          date_of_birth: previewProfile.date_of_birth,
        },
        pending: {},
        now: new Date(),
      });
      return ![result.gender, result.level, result.age].some(
        (field) => field.status === "existing_mismatch" || field.status === "entered_mismatch",
      );
    })();

    const shareLeague = async () => {
      const url = `${window.location.origin}${window.location.pathname}#/leagues/${previewLeague.id}`;
      try {
        if (typeof navigator !== "undefined" && navigator.share) {
          await navigator.share({ title: previewLeague.name, url });
          return;
        }
        await navigator.clipboard.writeText(url);
      } catch {
        // share dismissed / clipboard blocked
      }
    };

    return (
      <MainLayout pageClassName="leagues-shell" hideMobileNewMatch>
        <div className="leagues-redesign tpl">
          <LeagueJoinPageView
            league={previewLeague}
            capacity={detail?.metadata ?? null}
            eligibilityPass={eligibilityPass}
            distanceLabel={formatDistanceMiles(leagueVenueDistanceMiles(previewLeague))}
            priceLabel={formatLeaguePrice(previewLeague)}
            onBack={() => navigate("/leagues")}
            onShare={() => void shareLeague()}
            onJoin={() => requireLeagueAuth(() => void openJoinReview(previewLeague.id))}
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout pageClassName="leagues-shell" hideMobileNewMatch>
      <section className="league-detail">
        <Link className="league-detail__back" to="/leagues">Back to leagues</Link>
        <header className="league-detail__header">
          <div>
            <p className="leagues-page__eyebrow">Flex league</p>
            <h1>{league?.name || "League"}</h1>
            <p>{players.length ? `${players.length} active players` : "League details"}</p>
          </div>
          <div className="league-detail__actions">
            {league && getLeagueCardVariant(league) === "available" ? (
              <button
                type="button"
                onClick={() => requireLeagueAuth(() => void openJoinReview(league.id))}
              >
                Join League
              </button>
            ) : null}
            <button type="button" onClick={() => navigateWithLeagueAuth(`/leagues/${id}/post-availability`)}>Need a Match</button>
            <button type="button" onClick={() => requireLeagueAuth(() => navigate("/log-result", { state: { matchType: "league", leagueId: id } }))}>Add Score</button>
          </div>
        </header>

        {pendingCount ? (
          <div className="league-detail__pending-callout league-detail__pending-callout--compact">
            <span className="league-detail__pending-count">{pendingCount} pending match{pendingCount === 1 ? "" : "es"}</span>
            <button type="button" onClick={() => setActiveTab("pending")}>View</button>
          </div>
        ) : null}

        {!showNeedFlow ? (
          <section className="league-browser-preview" aria-label="Players looking for matches">
            <div className="league-browser-preview__head">
              <div>
                <h2>🎾 Players looking for matches</h2>
                <p>These players are looking at times similar to yours.</p>
              </div>
              {allNeedsCount || futureSuggestions.length ? (
                <span className="league-browser-preview__badge">{allNeedsCount || futureSuggestions.length} looking</span>
              ) : null}
            </div>
            {lookingPreview.length ? (
              <div className="league-browser-preview__list">
                {lookingPreview.map((item) => {
                  const record = standingsByPlayer.get(String(item.playerId));
                  return (
                    <button
                      type="button"
                      className="league-browser-preview__item"
                      key={item.key}
                      disabled={needSubmitting || !item.available}
                      onClick={() => item.available && previewAccept(item.type, item.id)}
                    >
                      <span className="league-browser-preview__player">
                        <strong>{item.name}</strong>
                        {item.tpr ? <em className="league-browser-preview__rating">TPR {item.tpr}</em> : null}
                        {record ? <em className="league-browser-preview__record">W-L {record.wins}-{record.losses}</em> : null}
                        {!item.available ? (
                          <em className="league-full-badge">Full</em>
                        ) : item.playedBefore === false ? (
                          <em className="league-browser-preview__new">✓ Still need to play</em>
                        ) : null}
                      </span>
                      <span className="league-browser-preview__when">
                        {item.when}{item.location ? ` · ${item.location}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="match-needs-empty match-needs-empty--compact">
                <p>No players looking for matches yet.</p>
              </div>
            )}
            <button type="button" className="cta-need-match" onClick={() => navigateWithLeagueAuth(`/leagues/${id}/post-availability`)}>+ Need a Match</button>
            <Link
              className="league-browser-preview__seeall"
              to={`/leagues/${id}/match-browser`}
              onClick={(event) => {
                if (!requiresLeagueAuthPrompt(isAuthenticated)) return;
                event.preventDefault();
                navigateWithLeagueAuth(`/leagues/${id}/match-browser`);
              }}
            >
              See all{allNeedsCount ? ` (${allNeedsCount})` : ""} →
            </Link>
          </section>
        ) : null}

        {!showNeedFlow ? (
          <nav className="league-detail__tabs" aria-label="League detail tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={activeTab === tab.key ? "active" : ""}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        ) : null}

        {loading ? <div className="leagues-page__state">Loading league...</div> : null}
        {error ? <div className="leagues-page__state leagues-page__state--error">{error}</div> : null}

        {showNeedFlow && needFlowStep === "precheck" ? (
          <div className="league-need-flow">
            <header className="league-need-flow__header">
              <h2>{suggestions.length ? "Wait!" : "Review match need"}</h2>
              <p>
                {suggestions.length
                  ? `${suggestions.length} player${suggestions.length === 1 ? "" : "s"} already looking near this time`
                  : "No close matches found. Review before posting."}
              </p>
            </header>

            <section className="league-need-flow__summary">
              <span>Your match need:</span>
              <strong>{formatDate(postedNeed?.start_date_time, postedNeed?.timezone)}</strong>
              <p>{formatTime(postedNeed?.start_date_time, postedNeed?.timezone)} · {postedNeed?.location_text || "Location TBD"}</p>
            </section>

            <section className="league-need-flow__section">
              <h3>Suggested matches:</h3>
              {suggestions.map((suggestion) => {
                const isSelected = String(suggestion.id) === String(selectedSuggestion?.id);
                return (
                  <button
                    className={`league-need-suggestion${isSelected ? " active" : ""}`}
                    key={suggestion.id}
                    type="button"
                    onClick={() => setSelectedSuggestionId(suggestion.id)}
                  >
                    <strong>{suggestion.player_name || "League player"}</strong>
                    <span>
                      {suggestion.time_variance_minutes !== undefined ? `${suggestion.time_variance_minutes} min apart` : "Similar time"}
                      {suggestion.distance_miles !== null && suggestion.distance_miles !== undefined ? ` · ${suggestion.distance_miles} mi` : ""}
                    </span>
                  </button>
                );
              })}
              {!suggestions.length ? <div className="league-detail__empty">No matching open needs within 4 hours and 5 miles.</div> : null}
            </section>

            {needError ? <p className="league-need-error">{needError}</p> : null}

            <div className="league-need-flow__actions league-need-flow__actions--stacked">
              <div>
                <button type="button" onClick={returnToNeedForm}>Back</button>
                <button type="button" disabled={!selectedSuggestion} onClick={() => setNeedFlowStep("accept")}>
                  View & Connect
                </button>
              </div>
              <button
                type="button"
                className="league-need-flow__outline"
                disabled={needSubmitting}
                onClick={() => requireLeagueAuth(() => void handlePostAnyway())}
              >
                {needSubmitting ? "Posting..." : suggestions.length ? "Post Anyway" : "Post Match Need"}
              </button>
            </div>
          </div>
        ) : null}

        {showNeedFlow && needFlowStep === "accept" && selectedSuggestion ? (
          <div className="league-need-flow">
            <header className="league-need-flow__header">
              <h2>Accept Match</h2>
              <p>Connect with {selectedSuggestion.player_name || "league player"}</p>
            </header>

            <section className="league-need-flow__summary">
              <span>League:</span>
              <strong>{league?.name || "League"}</strong>
            </section>
            <section className="league-need-flow__summary">
              <span>Your match:</span>
              <strong>{formatDate(postedNeed?.start_date_time, postedNeed?.timezone)}</strong>
              <p>{formatTime(postedNeed?.start_date_time, postedNeed?.timezone)} · {postedNeed?.location_text || "Location TBD"}</p>
            </section>
            <section className="league-need-flow__summary">
              <span>Opponent:</span>
              <strong>{selectedSuggestion.player_name || "League player"}</strong>
              <p>
                {selectedSuggestion.player_skill ? `TPR ${selectedSuggestion.player_skill}` : "League player"}
                {selectedSuggestion.has_played_before ? " · Played before" : ""}
              </p>
            </section>

            <label className="league-need-field">
              <span>Optional message (160 char)</span>
              <textarea
                maxLength={160}
                value={acceptMessage}
                placeholder={`Hey ${selectedSuggestion.player_name || "there"}, excited to play!`}
                onChange={(event) => setAcceptMessage(event.target.value)}
              />
            </label>

            {needError ? <p className="league-need-error">{needError}</p> : null}

            <div className="league-need-flow__actions">
              <button type="button" onClick={() => setNeedFlowStep("precheck")}>Back</button>
              <button type="button" disabled={needSubmitting} onClick={() => requireLeagueAuth(() => void handleAcceptSuggestion(selectedSuggestion.id))}>
                {needSubmitting ? "Accepting..." : "Accept"}
              </button>
            </div>
          </div>
        ) : null}

        {showNeedFlow && needFlowStep === "invite" ? (
          <div className="league-need-flow">
            <header className="league-need-flow__header">
              <h2>Invite Players</h2>
              <p>Post your match need</p>
            </header>

            <div className="league-need-flow__success">
              <strong>Match need posted</strong>
              <span>{formatNeedSummary(postedNeed)}</span>
            </div>

            <section className="league-need-flow__section">
              <h3>Still need to play (unplayed):</h3>
              {invitePlayers.map((player) => {
                const isChecked = selectedInviteIds.some((idValue) => String(idValue) === String(player.player_id));
                return (
                  <label className="league-need-invitee" key={player.player_id}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(event) => {
                        setSelectedInviteIds((current) => (
                          event.target.checked
                            ? [...current, player.player_id]
                            : current.filter((idValue) => String(idValue) !== String(player.player_id))
                        ));
                      }}
                    />
                    <span>{player.full_name || `Player ${player.player_id}`}</span>
                  </label>
                );
              })}
              {!invitePlayers.length ? <div className="league-detail__empty">No league players available to invite.</div> : null}
            </section>

            <label className="league-need-field">
              <span>Message template</span>
              <textarea
                maxLength={inviteMessageMaxLength}
                value={inviteMessage}
                onChange={(event) => setInviteMessage(event.target.value)}
              />
            </label>
            <p className="league-need-tip">{inviteMessage.length}/{inviteMessageMaxLength} characters</p>
            {inviteError ? <p className="league-need-error">{inviteError}</p> : null}

            <div className="league-need-flow__actions">
              <button type="button" onClick={() => (suggestions.length ? setNeedFlowStep("precheck") : setNeedFlowStep("idle"))}>Back</button>
              <button
                type="button"
                disabled={!selectedInviteIds.length || inviteSubmitting}
                onClick={() => requireLeagueAuth(() => void handleSendInvites())}
              >
                {inviteSubmitting ? "Sending..." : "Send Invites"}
              </button>
            </div>
          </div>
        ) : null}

        {!showNeedFlow && !loading && !error && activeTab === "standings" ? (
          <div className="league-table-wrap">
            <table className="league-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>MP</th>
                  <th>W-L</th>
                  <th>GD</th>
                  <th>GW</th>
                  <th>GL</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => (
                  <tr key={row.player_id}>
                    <td>{row.rank}</td>
                    <td>{displayValue(row.full_name)}</td>
                    <td>{row.matches_played}</td>
                    <td>{row.wins}-{row.losses}</td>
                    <td>{row.game_differential}</td>
                    <td>{row.games_for}</td>
                    <td>{row.games_against}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!standings.length ? <div className="league-detail__empty">No standings yet.</div> : null}
          </div>
        ) : null}

        {!showNeedFlow && !loading && !error && activeTab === "players" ? (
          <section className="league-ladder" aria-label="League ladder">
            <div className="league-ladder__filters" aria-label="Ladder filters">
              <span className="league-ladder__pill league-ladder__pill--active"><Target size={14} /> Rated players</span>
              <span className="league-ladder__pill league-ladder__pill--active"><MapPin size={14} /> Any listed court</span>
              <span className="league-ladder__pill"><TrendingUp size={14} /> Near my level</span>
            </div>

            {suggestedLadderRows.length ? (
              <>
                <div className="league-ladder__label">Suggested for you</div>
                <div className="league-ladder__suggested">
                  {suggestedLadderRows.map((row) => (
                    <article className="league-ladder-suggestion" key={row.playerId}>
                      <button
                        type="button"
                        className="league-ladder-suggestion__main"
                        onClick={() => setSelectedLadderPlayerId(row.playerId)}
                      >
                        <span className="league-ladder__avatar">{row.initials}</span>
                        <span>
                          <strong>{row.name}</strong>
                          <em>#{row.rank} · TPR {row.ratingLabel}</em>
                        </span>
                      </button>
                      <p>{row.suggestionReason || (row.courtLabels[0] ? `Plays ${row.courtLabels[0]}` : "Close ladder opponent")}</p>
                      <button type="button" className="league-ladder__challenge" onClick={() => challengeLadderPlayer(row)}>
                        <Swords size={14} /> Challenge
                      </button>
                    </article>
                  ))}
                </div>
              </>
            ) : null}

            <div className="league-ladder__grid">
              <div className="league-ladder-card">
                <div className="league-ladder-card__head">
                  <div>
                    <h2><Trophy size={17} /> Ladder</h2>
                    <p>{ladderRows.length} rated player{ladderRows.length === 1 ? "" : "s"}</p>
                  </div>
                  <label className="league-ladder-search" htmlFor="league-ladder-search">
                    <Search size={15} />
                    <input
                      id="league-ladder-search"
                      type="search"
                      placeholder="Search player"
                      value={ladderSearch}
                      onChange={(event) => setLadderSearch(event.target.value)}
                    />
                  </label>
                </div>

                <div className="league-ladder-table" role="table" aria-label="Rated league players">
                  <div className="league-ladder-row league-ladder-row--head" role="row">
                    <span>#</span>
                    <span>Player</span>
                    <span>Rating</span>
                    <span>NTRP</span>
                    <span>W-L</span>
                    <span />
                  </div>
                  {ladderRows.map((row) => (
                    <div
                      className={`league-ladder-row${row.isViewer ? " league-ladder-row--you" : ""}${selectedLadderPlayer?.playerId === row.playerId ? " league-ladder-row--selected" : ""}`}
                      key={row.playerId}
                      onClick={() => setSelectedLadderPlayerId(row.playerId)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedLadderPlayerId(row.playerId);
                        }
                      }}
                      role="row"
                      tabIndex={0}
                    >
                      <span className="league-ladder-row__rank">{row.rank}</span>
                      <span className="league-ladder-player">
                        <span className="league-ladder__avatar">{row.initials}</span>
                        <span>
                          <strong>{row.name}{row.isViewer ? <em className="league-ladder__you">You</em> : null}</strong>
                          <small>{[row.courtLabels[0], row.distanceLabel].filter(Boolean).join(" · ") || row.ratingSource || "League player"}</small>
                        </span>
                      </span>
                      <span className="league-ladder__rating">{row.ratingLabel}</span>
                      <span className="league-ladder__ntrp">{row.ntrpLabel}</span>
                      <span className="league-ladder__record">{row.recordLabel}</span>
                      <span className="league-ladder-row__action">
                        {row.isViewer ? (
                          <span className="league-ladder__pending">Your rank</span>
                        ) : (
                          <button
                            type="button"
                            className="league-ladder__challenge"
                            onClick={(event) => {
                              event.stopPropagation();
                              challengeLadderPlayer(row);
                            }}
                          >
                            <Swords size={14} /> Challenge
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                {!ladderRows.length ? <div className="league-detail__empty">No rated players yet.</div> : null}
              </div>

              {selectedLadderPlayer ? (
                <aside className="league-ladder-profile">
                  <div className="league-ladder-profile__top">
                    <span className="league-ladder__avatar league-ladder__avatar--lg">{selectedLadderPlayer.initials}</span>
                    <div>
                      <h2>{selectedLadderPlayer.name}</h2>
                      <p>Rank #{selectedLadderPlayer.rank} · TPR {selectedLadderPlayer.ratingLabel}</p>
                    </div>
                  </div>
                  <div className="league-ladder-profile__stats">
                    <span><em>Rating</em><strong>{selectedLadderPlayer.ratingLabel}</strong></span>
                    <span><em>NTRP</em><strong>{selectedLadderPlayer.ntrpLabel}</strong></span>
                    <span><em>UTR</em><strong>{selectedLadderPlayer.utrLabel}</strong></span>
                    <span><em>Record</em><strong>{selectedLadderPlayer.recordLabel}</strong></span>
                  </div>
                  <div className="league-ladder-profile__chips">
                    {selectedLadderPlayer.ratingBadge ? <span>{selectedLadderPlayer.ratingBadge}</span> : null}
                    {selectedLadderPlayer.ratingSource ? <span>{selectedLadderPlayer.ratingSource}</span> : null}
                    {selectedLadderPlayer.courtLabels.map((label) => <span key={label}><MapPin size={13} /> {label}</span>)}
                  </div>
                  {!selectedLadderPlayer.isViewer ? (
                    <button type="button" className="league-ladder-profile__cta" onClick={() => challengeLadderPlayer(selectedLadderPlayer)}>
                      <Swords size={15} /> Challenge with private match
                    </button>
                  ) : (
                    <p className="league-ladder-profile__note">This is where you stack up against nearby rated players.</p>
                  )}
                </aside>
              ) : null}
            </div>
          </section>
        ) : null}

        {!showNeedFlow && !loading && !error && activeTab === "results" ? (
          <>
            <div className="results-controls">
              <div className="results-controls__group">
                <label htmlFor="result-filter">Show</label>
                <select id="result-filter" value={resultFilter} onChange={(event) => setResultFilter(event.target.value as "all" | "mine")}>
                  <option value="all">All results</option>
                  <option value="mine">My results</option>
                </select>
              </div>
              <div className="results-controls__group">
                <label htmlFor="result-sort">Sort</label>
                <select id="result-sort" value={resultSort} onChange={(event) => setResultSort(event.target.value as "newest" | "oldest")}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </div>
            </div>
            <div className="league-list">
              {filteredResults.map((fixture) => {
                const winnerId = String((fixture as Record<string, unknown>).winner_id ?? "");
                const score = orientScore(fixture);
                return (
                  <article className="league-list__item" key={fixture.id}>
                    <Trophy size={16} />
                    <div>
                      <h2>
                        <span className={winnerId && winnerId === String(fixture.player1_id) ? "league-result-winner" : undefined}>
                          {fixture.player1_name || "Player 1"}
                        </span>
                        {" vs "}
                        <span className={winnerId && winnerId === String(fixture.player2_id) ? "league-result-winner" : undefined}>
                          {fixture.player2_name || "Player 2"}
                        </span>
                      </h2>
                      <p>{score || "Score TBD"} · {formatDate(fixture.played_date)}</p>
                    </div>
                  </article>
                );
              })}
              {!filteredResults.length ? (
                <div className="league-detail__empty">
                  {resultFilter === "mine" ? "No results for you yet." : "No results posted yet."}
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {!showNeedFlow && !loading && !error && activeTab === "scheduled" ? (
          <div className="league-list">
            {scheduled.length === 0 ? (
              <div className="leagues-page__state">
                No scheduled matches yet. Post a time you can play, or accept one another
                player has offered — agreed matches appear here.
              </div>
            ) : (
              scheduled.map((match) => {
                const timezone = match.timezone || DEFAULT_LEAGUE_TIMEZONE;
                return (
                  <article className="league-list__item league-list__item--pending" key={match.id}>
                    <CalendarDays size={16} />
                    <div className="league-list__item-body">
                      <div>
                        <h2>vs {match.opponentName}</h2>
                        <p>
                          {match.startDateTime ? formatDate(match.startDateTime, timezone) : "Date TBD"}
                          {" · "}
                          {match.startDateTime ? formatTime(match.startDateTime, timezone) : "Time TBD"}
                          {" · "}
                          {match.location || "Location TBD"}
                        </p>
                        {/* Who arranged it, so the pair know who to chase about a change. */}
                        <p className="league-list__item-meta">
                          {match.viewerIsHost ? "You posted this match" : "You accepted this match"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn-cancel-scheduled"
                        onClick={() => {
                          setCancelError(null);
                          setConfirmCancel(match);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        ) : null}

        {!showNeedFlow && !loading && !error && activeTab === "pending" ? (
          <div className="league-list">
            {suggestions.map((suggestion) => (
              <article className="league-list__item league-list__item--suggestion" key={suggestion.id}>
                <Trophy size={16} />
                <div>
                  <h2>{suggestion.player_name || "League player"} wants to play</h2>
                  <p>
                    {suggestion.match_date || "Date TBD"} · {suggestion.match_time || "Time TBD"} · {suggestion.match_location || "Location TBD"}
                    {suggestion.time_variance_minutes !== undefined ? ` · ${suggestion.time_variance_minutes} min apart` : ""}
                  </p>
                  <button type="button" onClick={() => requireLeagueAuth(() => void handleAcceptSuggestion(suggestion.id))}>
                    Accept match
                  </button>
                </div>
              </article>
            ))}
            {pending.map((fixture) => (
              <article className="league-list__item league-list__item--pending" key={fixture.id}>
                <CalendarDays size={16} />
                <div className="league-list__item-body">
                  <div>
                    <h2>{getPendingOpponent(fixture, userId)}</h2>
                    <p>Match #{fixture.match_number ?? fixture.id} · pending score</p>
                  </div>
                  <button type="button" className="btn-quick-invite" onClick={() => quickInvite(fixture)}>
                    Quick Invite
                  </button>
                </div>
              </article>
            ))}
            {!pending.length && !suggestions.length ? (
              <div className="league-detail__empty">
                <Users size={20} />
                No pending matches.
              </div>
            ) : null}
          </div>
        ) : null}

        {isNeedDrawerOpen ? (
          <div className="league-need-drawer" role="dialog" aria-modal="true" aria-label="Need a match">
            <div className="league-need-drawer__backdrop" onClick={() => setNeedDrawerOpen(false)} />
            <div className="league-need-drawer__panel">
              <div className="league-need-drawer__header">
                <div>
                  <h2>Need a match?</h2>
                  <p>Post your availability and find opponents</p>
                </div>
                <button type="button" aria-label="Close" onClick={() => setNeedDrawerOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <label className="league-need-field">
                <span>Date</span>
                <input type="date" value={needDate} onChange={(event) => setNeedDate(event.target.value)} />
              </label>
              <label className="league-need-field">
                <span>Time</span>
                <input type="time" value={needTime} onChange={(event) => setNeedTime(event.target.value)} />
              </label>
              <label className="league-need-field">
                <span>Location</span>
                <Autocomplete
                  apiKey={import.meta.env.VITE_GOOGLE_API_KEY || undefined}
                  placeholder="Search court or address"
                  value={needLocation}
                  onChange={(event) => {
                    const nextLocation = event.target.value;
                    setNeedLocation(nextLocation);
                    if (normalizeIdentity(nextLocation) === normalizeIdentity(defaultNeedLocation.label)) {
                      setNeedLatitude(defaultNeedLocation.latitude);
                      setNeedLongitude(defaultNeedLocation.longitude);
                    } else {
                      setNeedLatitude(null);
                      setNeedLongitude(null);
                    }
                  }}
                  onPlaceSelected={handleNeedPlaceSelected}
                  options={{
                    types: ["geocode", "establishment"],
                    fields: ["formatted_address", "geometry", "name", "address_components"],
                    componentRestrictions: { country: "us" },
                  }}
                />
              </label>
              <label className="league-need-check">
                <input
                  type="checkbox"
                  checked={shareWithLeagueOnly}
                  onChange={(event) => setShareWithLeagueOnly(event.target.checked)}
                />
                <span>Share with league members only</span>
              </label>

              {needError ? <p className="league-need-error">{needError}</p> : null}
              {!import.meta.env.VITE_GOOGLE_API_KEY ? (
                <p className="league-need-tip">Add `VITE_GOOGLE_API_KEY` to enable Google location suggestions.</p>
              ) : null}
              <p className="league-need-tip">We'll check for existing matches before posting.</p>

              <div className="league-need-drawer__actions">
                <button type="button" onClick={() => setNeedDrawerOpen(false)}>Cancel</button>
                <button type="button" disabled={!needDate || !needTime || !needLocation || needSubmitting} onClick={() => requireLeagueAuth(() => void handlePreviewNeed())}>
                  {needSubmitting ? "Checking..." : "Next"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {confirmAccept ? (
          <div className="league-confirm" role="dialog" aria-modal="true" aria-label="Confirm match request">
            <div className="league-confirm__backdrop" onClick={() => setConfirmAccept(null)} />
            <div className="league-confirm__panel">
              <h2>Join this match?</h2>
              <p className="league-confirm__player">{confirmAccept.name}</p>
              {confirmAccept.when || confirmAccept.location ? (
                <p className="league-confirm__meta">
                  {[confirmAccept.when, confirmAccept.location].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              <p className="league-confirm__note">
                You'll be matched with {confirmAccept.name} and it moves to your scheduled matches.
              </p>
              {needError ? <p className="league-need-error">{needError}</p> : null}
              <div className="league-confirm__actions">
                <button type="button" onClick={() => setConfirmAccept(null)}>Cancel</button>
                <button type="button" disabled={needSubmitting} onClick={() => requireLeagueAuth(() => void requestMatch())}>
                  {needSubmitting ? "Joining..." : "Join match"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {confirmCancel ? (
          <div className="league-confirm" role="dialog" aria-modal="true" aria-label="Cancel this match">
            <div className="league-confirm__backdrop" onClick={() => setConfirmCancel(null)} />
            <div className="league-confirm__panel">
              <h2>Cancel this match?</h2>
              <p className="league-confirm__player">{confirmCancel.opponentName}</p>
              {confirmCancel.startDateTime || confirmCancel.location ? (
                <p className="league-confirm__meta">
                  {[
                    confirmCancel.startDateTime
                      ? `${formatDate(confirmCancel.startDateTime, confirmCancel.timezone || DEFAULT_LEAGUE_TIMEZONE)} · ${formatTime(confirmCancel.startDateTime, confirmCancel.timezone || DEFAULT_LEAGUE_TIMEZONE)}`
                      : null,
                    confirmCancel.location,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
              <p className="league-confirm__note">
                {firstNameOf(confirmCancel.opponentName)} will be told. If the match is soon,
                message them as well so they have a chance to find another.
              </p>
              {cancelError ? <p className="league-need-error">{cancelError}</p> : null}
              <div className="league-confirm__actions">
                <button type="button" onClick={() => setConfirmCancel(null)}>
                  Keep match
                </button>
                <button
                  type="button"
                  className="league-confirm__destructive"
                  disabled={cancelSubmitting}
                  onClick={() => void cancelScheduled()}
                >
                  {cancelSubmitting ? "Cancelling..." : "Cancel match"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {acceptedMatch ? (
          <div className="league-confirm" role="dialog" aria-modal="true" aria-label="Match confirmed">
            <div className="league-confirm__backdrop" onClick={() => setAcceptedMatch(null)} />
            <div className="league-confirm__panel">
              <h2>Match confirmed</h2>
              <p className="league-confirm__player">{acceptedMatch.name}</p>
              {acceptedMatch.when || acceptedMatch.location ? (
                <p className="league-confirm__meta">
                  {[acceptedMatch.when, acceptedMatch.location].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              <p className="league-confirm__note">
                We've let {firstNameOf(acceptedMatch.name)} know. It's still worth messaging
                them to confirm the time and court — matches that get a quick hello beforehand
                are the ones that actually get played.
              </p>
              {/* Hidden rather than disabled when there is no usable start: an "add to
                  calendar" button that cannot add anything is worse than no button. */}
              {acceptedCalendarUrl ? (
                <a
                  className="league-confirm__calendar"
                  href={acceptedCalendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <CalendarDays size={15} aria-hidden /> Add to Google Calendar
                </a>
              ) : null}
              <p className="league-confirm__cancel-note">
                Plans change — but if you need to cancel, tell {firstNameOf(acceptedMatch.name)}{" "}
                in plenty of time so they can find another match.
              </p>
              <div className="league-confirm__actions league-confirm__actions--single">
                <button type="button" onClick={() => setAcceptedMatch(null)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </MainLayout>
  );
};

export default LeagueDetailPage;
