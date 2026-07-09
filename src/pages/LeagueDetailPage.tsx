import { useEffect, useMemo, useRef, useState } from "react";
import Autocomplete from "react-google-autocomplete";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, Check, Info, Mail, Phone, Trophy, Users, X } from "lucide-react";

import {
  type League,
  type LeagueFixture,
  type LeagueMatchNeed,
  type LeagueMatchSuggestion,
  type LeaguePlayer,
  type LeagueResultOpponent,
  type LeagueStanding,
  acceptLeagueMatchSuggestion,
  isLeagueSlotAvailable,
  acceptLeagueMatchNeedPreview,
  createLeagueResult,
  createLeagueMatchNeed,
  getLeagueFixtures,
  getLeagueMatchNeeds,
  getLeaguePlayers,
  getLeagueResultOpponents,
  getLeagueStandings,
  previewLeagueMatchNeed,
  sendLeagueMatchNeedInvites,
} from "../api/leagues";
import type { PlayerPersonalDetails } from "../api/playerProfile";
import { getPlayerPersonalDetails } from "../api/playerProfile";
import AuthDrawer from "../components/auth/AuthDrawer";
import MainLayout from "../components/MainLayout";
import { useAuth } from "../context/AuthContext";
import LeagueJoinReviewSheet from "../features/leagueJoin/LeagueJoinReviewSheet";
import { getStoredAuthToken } from "../services/authToken";
import {
  DEFAULT_LEAGUE_TIMEZONE,
  formatLeagueDate as formatDate,
  formatLeagueTime as formatTime,
  isFutureLeagueItem,
} from "./leagueDetailTime";
import { getLeagueCardVariant } from "./leagueBrowse";
import { requiresLeagueAuthPrompt } from "./leagueAuthGate";
import { orientScore } from "./leagueScore";

import "./LeaguesPage.css";

type TabKey = "standings" | "players" | "results" | "pending";
type NeedFlowStep = "idle" | "precheck" | "accept" | "invite";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "standings", label: "Standings" },
  { key: "players", label: "Players" },
  { key: "results", label: "Results" },
  { key: "pending", label: "Pending" },
];

const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const formatTrp = (value: unknown) => {
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

const getApiErrorMessage = (error: unknown) => {
  const apiError = error as {
    data?: { detail?: string; error?: string; errors?: string[] };
    message?: string;
  };

  if (apiError.data?.detail) return apiError.data.detail;
  if (apiError.data?.errors?.length) return apiError.data.errors.join(", ");
  return apiError.data?.error || apiError.message || "We couldn't load your profile for league join.";
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
  const [reloadKey, setReloadKey] = useState(0);
  const [resultFilter, setResultFilter] = useState<"all" | "mine">("all");
  const [resultSort, setResultSort] = useState<"newest" | "oldest">("newest");
  // Clicking a match need previews it here; joining is an explicit confirm (no auto-join).
  const [confirmAccept, setConfirmAccept] = useState<{
    type: "suggestion" | "need";
    id: number | string;
    name: string;
    when?: string;
    location?: string | null;
  } | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [standings, setStandings] = useState<LeagueStanding[]>([]);
  const [players, setPlayers] = useState<LeaguePlayer[]>([]);
  const [results, setResults] = useState<LeagueFixture[]>([]);
  const [pending, setPending] = useState<LeagueFixture[]>([]);
  const [matchNeeds, setMatchNeeds] = useState<LeagueMatchNeed[]>([]);
  const [allNeeds, setAllNeeds] = useState<LeagueMatchNeed[]>([]);
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
  const [isNeedDrawerOpen, setNeedDrawerOpen] = useState(false);
  const [needDate, setNeedDate] = useState(todayInputValue);
  const [needTime, setNeedTime] = useState("");
  const [needLocation, setNeedLocation] = useState(defaultNeedLocation.label);
  const [needLatitude, setNeedLatitude] = useState<number | null>(defaultNeedLocation.latitude);
  const [needLongitude, setNeedLongitude] = useState<number | null>(defaultNeedLocation.longitude);
  const [shareWithLeagueOnly, setShareWithLeagueOnly] = useState(true);
  const [needSubmitting, setNeedSubmitting] = useState(false);
  const [needError, setNeedError] = useState<string | null>(null);
  const [isScoreDrawerOpen, setScoreDrawerOpen] = useState(false);
  const [resultOpponents, setResultOpponents] = useState<LeagueResultOpponent[]>([]);
  const [scoreOpponentId, setScoreOpponentId] = useState("");
  const [scoreDate, setScoreDate] = useState(todayInputValue);
  const [scoreFormat, setScoreFormat] = useState<"single" | "bo3">("single");
  const [scoreLocation, setScoreLocation] = useState("Penmar Courts");
  const [scoreLatitude, setScoreLatitude] = useState<number | null>(null);
  const [scoreLongitude, setScoreLongitude] = useState<number | null>(null);
  const [scoreSets, setScoreSets] = useState([
    { kind: "set" as const, you: 0, opp: 0 },
    { kind: "set" as const, you: 0, opp: 0 },
    { kind: "set" as const, you: 0, opp: 0 },
  ]);
  const [scoreSubmitting, setScoreSubmitting] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [scoreSubmitted, setScoreSubmitted] = useState<{
    matchId: number | string | null;
    status: string;
    opponentName: string;
    scoreString: string;
  } | null>(null);
  const [authDrawerOpen, setAuthDrawerOpen] = useState(false);
  const [joinReviewOpen, setJoinReviewOpen] = useState(false);
  const [joinReviewProfile, setJoinReviewProfile] = useState<PlayerPersonalDetails | null>(null);
  const [joinReviewLoading, setJoinReviewLoading] = useState(false);
  const [joinReviewError, setJoinReviewError] = useState<string | null>(null);

  const openJoinReview = (leagueId: League["id"]) => {
    if (!leagueId) {
      return;
    }

    setJoinReviewOpen(true);
  };

  useEffect(() => {
    if (!joinReviewOpen) {
      return;
    }

    if (!token) {
      setJoinReviewProfile(null);
      setJoinReviewError("Please sign in again to continue.");
      setJoinReviewLoading(false);
      return;
    }

    const controller = new AbortController();
    setJoinReviewLoading(true);
    setJoinReviewError(null);

    getPlayerPersonalDetails({ token, signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) {
          setJoinReviewProfile(response);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setJoinReviewProfile(null);
          setJoinReviewError(getApiErrorMessage(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setJoinReviewLoading(false);
        }
      });

    return () => controller.abort();
  }, [joinReviewOpen, token]);

  const requireLeagueAuth = (action?: () => void) => {
    if (!requiresLeagueAuthPrompt(isAuthenticated)) {
      action?.();
      return true;
    }
    pendingAuthActionRef.current = action ?? null;
    setAuthDrawerOpen(true);
    return false;
  };

  const handleLeagueAuthenticated = () => {
    const action = pendingAuthActionRef.current;
    pendingAuthActionRef.current = null;
    action?.();
  };

  const navigateWithLeagueAuth = (to: string, state?: Record<string, unknown>) => {
    requireLeagueAuth(() => navigate(to, state ? { state } : undefined));
  };

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Promise.all([
      getLeagueStandings({ leagueId: id, token, signal: controller.signal }),
      getLeaguePlayers({ leagueId: id, token, signal: controller.signal }),
      getLeagueFixtures({ leagueId: id, token, status: "confirmed", signal: controller.signal }),
      getLeagueFixtures({ leagueId: id, token, status: "scheduled", mine: true, signal: controller.signal }),
      getLeagueMatchNeeds({ leagueId: id, token, signal: controller.signal }),
      getLeagueMatchNeeds({ leagueId: id, token, scope: "all", signal: controller.signal }),
    ])
      .then(([standingsResponse, playersResponse, resultsResponse, pendingResponse, needsResponse, allNeedsResponse]) => {
        setLeague(standingsResponse.league ?? playersResponse.league);
        setStandings(standingsResponse.standings ?? []);
        setPlayers(playersResponse.players ?? []);
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
  }, [id, token, reloadKey]);

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
  // W-L record lookup (from standings) + TRP lookup (from players) by player id —
  // fixtures/suggestions don't carry win/loss or rating.
  const standingsByPlayer = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number }>();
    standings.forEach((row) => map.set(String(row.player_id), { wins: row.wins, losses: row.losses }));
    return map;
  }, [standings]);
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
          trp: formatTrp(s.player_skill),
          when: `${formatDate(s.match_date, s.timezone)} · ${formatTime(s.match_time, s.timezone)}`,
          location: s.match_location || null,
          playerId: s.suggested_player_id,
          playedBefore: s.has_played_before,
          available: isLeagueSlotAvailable(s),
        }))
      : futureNeeds.map((n) => ({
          key: `n-${n.id}`, id: n.id, type: "need" as const,
          name: n.player_name || "League player",
          trp: formatTrp(n.player_skill),
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
      setActiveTab("pending");
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
      setActiveTab("pending");
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
        });
      } else {
        const n = allNeeds.find((x) => String(x.id) === String(itemId));
        setConfirmAccept({
          type,
          id: itemId,
          name: n?.player_name || "League player",
          when: n ? `${formatDate(n.start_date_time, n.timezone)} · ${formatTime(n.start_date_time, n.timezone)}` : undefined,
          location: n?.match_location ?? n?.location ?? n?.location_text ?? null,
        });
      }
    });
  };

  // Explicit join — only fires from the confirm dialog's "Request match" button.
  const requestMatch = async () => {
    if (!confirmAccept) return;
    const { type, id: acceptId } = confirmAccept;
    const ok = type === "suggestion"
      ? await handleAcceptSuggestion(acceptId)
      : await handleAcceptOpenNeed(acceptId);
    if (ok) setConfirmAccept(null); // on failure keep the dialog open so the error shows
  };

  // MatchBrowserPage hands off posting/connecting via router state. Posting opens the
  // drawer; a clicked need/suggestion opens the confirm preview — never auto-joins.
  useEffect(() => {
    if (loading || navStateHandledRef.current) return;
    const navState = routerLocation.state as
      | { openPost?: boolean; openScore?: boolean; acceptSuggestionId?: number | string; acceptNeedId?: number | string; returnTo?: string }
      | null;
    if (!navState) return;
    navStateHandledRef.current = true;
    returnToRef.current = navState.returnTo ?? null;
    if (navState.openPost) {
      requireLeagueAuth(openNeedDrawer);
    } else if (navState.openScore) {
      requireLeagueAuth(() => {
        void openScoreDrawer();
      });
    } else if (navState.acceptSuggestionId != null) {
      previewAccept("suggestion", navState.acceptSuggestionId);
    } else if (navState.acceptNeedId != null) {
      previewAccept("need", navState.acceptNeedId);
    }
    navigate(`/leagues/${id}`, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, routerLocation.state]);

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

  // Close the score drawer, returning to the launching page (e.g. the dashboard)
  // when one was provided via nav-state — otherwise just close in place.
  const closeScoreDrawer = () => {
    setScoreDrawerOpen(false);
    setScoreSubmitted(null);
    const to = returnToRef.current;
    if (to) {
      returnToRef.current = null;
      navigate(to);
    }
  };

  const openScoreDrawer = async () => {
    if (!id) return;
    setScoreDrawerOpen(true);
    setScoreError(null);
    setScoreSubmitted(null);
    try {
      const response = await getLeagueResultOpponents({ leagueId: id, token });
      const opponents = response.opponents ?? [];
      setResultOpponents(opponents);
      setScoreOpponentId(opponents[0]?.player_id ? String(opponents[0].player_id) : "");
    } catch (err) {
      setScoreError(err instanceof Error ? err.message : "Failed to load league opponents");
      setResultOpponents([]);
    }
  };

  const handleScorePlaceSelected = (place: google.maps.places.PlaceResult | null) => {
    const latitude = place?.geometry?.location?.lat?.();
    const longitude = place?.geometry?.location?.lng?.();
    const label = place?.formatted_address || place?.name || scoreLocation;

    if (label) setScoreLocation(label);
    if (typeof latitude === "number" && Number.isFinite(latitude)) setScoreLatitude(latitude);
    if (typeof longitude === "number" && Number.isFinite(longitude)) setScoreLongitude(longitude);
  };

  const updateScoreSet = (index: number, side: "you" | "opp", value: string) => {
    const nextValue = Math.max(0, Number.parseInt(value || "0", 10) || 0);
    setScoreSets((current) => current.map((set, setIndex) => (
      setIndex === index ? { ...set, [side]: nextValue } : set
    )));
  };

  const buildScoreString = (sets: typeof scoreSets) => (
    sets
      .filter((set) => set.you !== 0 || set.opp !== 0)
      .map((set) => `${set.you}-${set.opp}`)
      .join(" ")
  );

  const handleSubmitScore = async () => {
    if (!id || !scoreOpponentId) return;
    setScoreSubmitting(true);
    setScoreError(null);
    try {
      const activeSets = scoreSets
        .slice(0, scoreFormat === "single" ? 1 : 3)
        .filter((set) => set.you !== 0 || set.opp !== 0);
      const response = await createLeagueResult({
        leagueId: id,
        token,
        body: {
          player_b: scoreOpponentId,
          played_at: scoreDate,
          location: scoreLocation,
          latitude: scoreLatitude,
          longitude: scoreLongitude,
          format: scoreFormat,
          retired: false,
          sets: activeSets,
          score_string: buildScoreString(activeSets),
        },
      });
      const opponent = resultOpponents.find(
        (item) => String(item.player_id) === String(scoreOpponentId),
      );
      // Show the pending-confirmation screen instead of silently closing.
      setScoreSubmitted({
        matchId: response?.match_id ?? null,
        status: response?.status || "pending",
        opponentName: opponent?.full_name || "Your opponent",
        scoreString: buildScoreString(activeSets),
      });
      setReloadKey((key) => key + 1); // refresh results/pending so the new result shows
    } catch (err) {
      const data = (err as { data?: { errors?: string[] } })?.data;
      setScoreError(data?.errors?.join(", ") || (err instanceof Error ? err.message : "Failed to submit score"));
    } finally {
      setScoreSubmitting(false);
    }
  };

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
            <button type="button" onClick={() => requireLeagueAuth(() => void openScoreDrawer())}>Add Score</button>
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
                        {item.trp ? <em className="league-browser-preview__rating">TRP {item.trp}</em> : null}
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
                {selectedSuggestion.player_skill ? `TRP ${selectedSuggestion.player_skill}` : "League player"}
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
          <div className="league-table-wrap">
            <table className="league-table league-table--players">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>TRP</th>
                  <th>NTRP</th>
                  <th>UTR</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => (
                  <tr key={player.player_id}>
                    <td>
                      {player.phone ? (
                        <a className="league-player-link" href={`sms:${player.phone}`}>{displayValue(player.full_name)}</a>
                      ) : (
                        displayValue(player.full_name)
                      )}
                    </td>
                    <td className="league-table__rating">{formatTrp(player.current_rating) ?? "-"}</td>
                    <td>{displayValue(player.usta_rating)}</td>
                    <td>{displayValue(player.uta_rating)}</td>
                    <td>
                      <div className="league-contact">
                        {player.phone ? <a href={`tel:${player.phone}`}><Phone size={13} />{player.phone}</a> : null}
                        {player.email ? <a href={`mailto:${player.email}`}><Mail size={13} />{player.email}</a> : null}
                        {!player.phone && !player.email ? "-" : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!players.length ? <div className="league-detail__empty">No active players yet.</div> : null}
          </div>
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

        {isScoreDrawerOpen ? (
          <div className="league-need-drawer" role="dialog" aria-modal="true" aria-label="Add score">
            <div className="league-need-drawer__backdrop" onClick={closeScoreDrawer} />
            <div className="league-need-drawer__panel">
              {scoreSubmitted ? (
                <div className="league-score-confirm">
                  <div className="league-score-confirm__icon"><Check size={26} /></div>
                  <h2>Score submitted</h2>
                  <p>Pending {scoreSubmitted.opponentName}'s confirmation.</p>
                  <div className="league-score-confirm__card">
                    <span className="league-score-confirm__status">
                      {scoreSubmitted.status === "pending" ? "Awaiting confirmation" : scoreSubmitted.status}
                    </span>
                    <div className="league-score-confirm__score">
                      <strong>vs {scoreSubmitted.opponentName}</strong>
                      {scoreSubmitted.scoreString ? <span>{scoreSubmitted.scoreString}</span> : null}
                    </div>
                    <p className="league-score-confirm__next">
                      <Info size={14} />
                      <span>
                        {scoreSubmitted.opponentName} gets a text to confirm or dispute the score. Once
                        they confirm, ratings and standings update.
                      </span>
                    </p>
                    {scoreSubmitted.matchId != null ? (
                      <p className="league-score-confirm__id">Result #{scoreSubmitted.matchId}</p>
                    ) : null}
                  </div>
                  <div className="league-need-drawer__actions">
                    <button type="button" onClick={closeScoreDrawer}>Done</button>
                    <button
                      type="button"
                      onClick={() => {
                        closeScoreDrawer();
                        setActiveTab("pending");
                      }}
                    >
                      View pending
                    </button>
                  </div>
                </div>
              ) : (
                <>
              <div className="league-need-drawer__header">
                <div>
                  <h2>Add score</h2>
                  <p>Submit a league result for opponent confirmation</p>
                </div>
                <button type="button" aria-label="Close" onClick={closeScoreDrawer}>
                  <X size={20} />
                </button>
              </div>

              <label className="league-need-field">
                <span>Opponent</span>
                <select value={scoreOpponentId} onChange={(event) => setScoreOpponentId(event.target.value)}>
                  {resultOpponents.map((opponent) => (
                    <option key={opponent.player_id} value={opponent.player_id}>
                      {opponent.full_name || `Player ${opponent.player_id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="league-need-field">
                <span>Date played</span>
                <input type="date" value={scoreDate} onChange={(event) => setScoreDate(event.target.value)} />
              </label>
              <label className="league-need-field">
                <span>Location</span>
                <Autocomplete
                  apiKey={import.meta.env.VITE_GOOGLE_API_KEY || undefined}
                  placeholder="Search court or address"
                  value={scoreLocation}
                  onChange={(event) => {
                    setScoreLocation(event.target.value);
                    setScoreLatitude(null);
                    setScoreLongitude(null);
                  }}
                  onPlaceSelected={handleScorePlaceSelected}
                  options={{
                    types: ["geocode", "establishment"],
                    fields: ["formatted_address", "geometry", "name", "address_components"],
                    componentRestrictions: { country: "us" },
                  }}
                />
              </label>

              <div className="league-score-format">
                <button
                  type="button"
                  className={scoreFormat === "single" ? "active" : ""}
                  onClick={() => setScoreFormat("single")}
                >
                  1 set
                </button>
                <button
                  type="button"
                  className={scoreFormat === "bo3" ? "active" : ""}
                  onClick={() => setScoreFormat("bo3")}
                >
                  Best of 3
                </button>
              </div>

              {scoreSets.slice(0, scoreFormat === "single" ? 1 : 3).map((set, index) => (
                <div className="league-score-set" key={index}>
                  <h3>Set {index + 1}</h3>
                  <label>
                    <span>You</span>
                    <input
                      type="number"
                      min="0"
                      value={set.you}
                      onChange={(event) => updateScoreSet(index, "you", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Opponent</span>
                    <input
                      type="number"
                      min="0"
                      value={set.opp}
                      onChange={(event) => updateScoreSet(index, "opp", event.target.value)}
                    />
                  </label>
                </div>
              ))}

              {scoreError ? <p className="league-need-error">{scoreError}</p> : null}
              {!resultOpponents.length ? (
                <p className="league-need-tip">No available league opponents. Players already recorded against you are filtered out.</p>
              ) : (
                <p className="league-need-tip">Opponent receives a confirmation message before result counts.</p>
              )}

              <div className="league-need-drawer__actions">
                <button type="button" onClick={closeScoreDrawer}>Cancel</button>
                <button
                  type="button"
                  disabled={!scoreOpponentId || !scoreDate || !scoreLocation || scoreSubmitting}
                  onClick={() => requireLeagueAuth(() => void handleSubmitScore())}
                >
                  {scoreSubmitting ? "Submitting..." : "Submit score"}
                </button>
              </div>
                </>
              )}
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
                You'll be matched with {confirmAccept.name} and it moves to your pending matches to play.
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
        <AuthDrawer
          open={authDrawerOpen}
          onClose={() => {
            pendingAuthActionRef.current = null;
            setAuthDrawerOpen(false);
          }}
          onAuthenticated={handleLeagueAuthenticated}
          initialMode="signup"
          title="Join the league"
          subtitle="Sign in or create an account to post availability, join matches, and submit scores."
        />
        {joinReviewOpen && league ? (
          <LeagueJoinReviewSheet
            league={league}
            profile={joinReviewProfile}
            token={token}
            loading={joinReviewLoading}
            profileError={joinReviewError}
            onClose={() => setJoinReviewOpen(false)}
            onEligible={() => setJoinReviewOpen(false)}
          />
        ) : null}
      </section>
    </MainLayout>
  );
};

export default LeagueDetailPage;
