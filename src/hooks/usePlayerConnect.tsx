import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { getAllSurveyQuestionAnswered } from "../api/playerHome";
import ConnectPlayerModal from "../components/players/ConnectPlayerModal";
import MatchProfileModal from "../components/players/MatchProfileModal";
import usePlayerIdentity from "./usePlayerIdentity";
import { getStoredAuthToken } from "../services/authToken";
import type { ConnectIntent } from "../types/matchPlay";
import {
  buildMatchProfileFromSurvey,
  getStoredMatchProfile,
  hasIncompleteMatchProfileQuestions,
  sanitizeMatchProfile,
  storeMatchProfile,
  toCanonicalAvailability,
  type StoredMatchProfile,
} from "../utils/matchProfile";
import { buildSmsUrl, getSmsRecipient } from "../utils/smsLink";
import type { DirectoryPlayer } from "../utils/suggestedPlayer";

export type ConnectMethod = "sms_intro" | "match_invite";

const formatAvailabilityList = (slots: string[]): string => {
  const cleaned = slots
    .map((slot) => (typeof slot === "string" ? toCanonicalAvailability(slot) : ""))
    .filter((slot) => slot.length > 0);

  if (cleaned.length === 0) {
    return "Weekends";
  }
  if (cleaned.length === 1) {
    return cleaned[0];
  }
  if (cleaned.length === 2) {
    return `${cleaned[0]} and ${cleaned[1]}`;
  }
  const head = cleaned.slice(0, -1).join(", ");
  return `${head}, and ${cleaned[cleaned.length - 1]}`;
};

interface UsePlayerConnectOptions {
  /** False skips loading the match profile, so an unused hook costs no request. */
  enabled?: boolean;
  /** ConnectIntent.source for a MatchPlay invite, e.g. "find-players" or "home". */
  source: string;
  /** Connect was tapped but the viewer's match profile isn't complete, so the profile form opens instead. */
  onConnectGated?: (player: DirectoryPlayer) => void;
  /** The viewer chose how to connect. */
  onConnectSent?: (player: DirectoryPlayer, method: ConnectMethod) => void;
  /** The match profile form was saved; `trigger` is what opened it. */
  onProfileCompleted?: (trigger: string | null) => void;
}

/**
 * Connect, as Find Players does it, for any page that shows player cards.
 *
 * Loads the viewer's match profile once (their survey answers), gates Connect on it
 * being complete, and owns both modals: ConnectPlayerModal (SMS intro or MatchPlay
 * invite) and MatchProfileModal (the gate). Render `modals` once on the page.
 * Analytics stay with the page, through the callbacks.
 */
export default function usePlayerConnect({
  enabled = true,
  source,
  onConnectGated,
  onConnectSent,
  onProfileCompleted,
}: UsePlayerConnectOptions) {
  const navigate = useNavigate();
  const location = useLocation();
  const { displayName } = usePlayerIdentity();
  const [playerToken] = useState(() =>
    getStoredAuthToken({ defaultScheme: "token", preferScheme: "token" }) ?? undefined,
  );
  const [matchProfile, setMatchProfile] = useState<StoredMatchProfile | null>(() => getStoredMatchProfile());
  const [hasIncompleteMatchProfile, setHasIncompleteMatchProfile] = useState(false);
  const [matchProfileCheckLoaded, setMatchProfileCheckLoaded] = useState(false);
  const [connectModalPlayer, setConnectModalPlayer] = useState<DirectoryPlayer | null>(null);
  const [isConnectModalOpen, setConnectModalOpen] = useState(false);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [promptTrigger, setPromptTrigger] = useState<string | null>(null);

  const hasCompletedMatchProfile = Boolean(matchProfile) && matchProfileCheckLoaded && !hasIncompleteMatchProfile;

  const requireSignIn = useCallback(() => {
    navigate("/login", { state: { from: location } });
  }, [location, navigate]);

  useEffect(() => {
    let cancelled = false;

    if (!enabled) return undefined;

    if (!playerToken) {
      setHasIncompleteMatchProfile(false);
      setMatchProfileCheckLoaded(true);
      return undefined;
    }

    const loadAnsweredQuestions = async () => {
      setMatchProfileCheckLoaded(false);
      try {
        const answered = await getAllSurveyQuestionAnswered({ token: playerToken });
        if (cancelled) return;
        const nextIncomplete = hasIncompleteMatchProfileQuestions(answered);
        const savedProfile = buildMatchProfileFromSurvey(answered, getStoredMatchProfile());
        if (savedProfile) {
          setMatchProfile(savedProfile);
          storeMatchProfile(savedProfile);
        }
        setHasIncompleteMatchProfile(nextIncomplete);
      } catch (requestError) {
        if (cancelled) return;
        console.error("Failed to load answered match profile questions", requestError);
        setHasIncompleteMatchProfile(!getStoredMatchProfile());
      } finally {
        if (!cancelled) {
          setMatchProfileCheckLoaded(true);
        }
      }
    };

    void loadAnsweredQuestions();

    return () => {
      cancelled = true;
    };
  }, [enabled, playerToken]);

  const profileShareUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "https://tennisplan.app/#/settings/match-profile";
    }
    const { origin, pathname } = window.location;
    const normalizedPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
    return `${origin}${normalizedPath}#/settings/match-profile`;
  }, []);

  const closeConnectModal = useCallback(() => {
    setConnectModalOpen(false);
    setConnectModalPlayer(null);
  }, []);

  const openProfileModal = useCallback((trigger: string) => {
    setPromptTrigger(trigger);
    setProfileModalOpen(true);
  }, []);

  /** Opens Connect for a player, or the profile gate, or sign-in. */
  const openConnect = useCallback(
    (player: DirectoryPlayer) => {
      if (!hasCompletedMatchProfile) {
        if (!playerToken) {
          requireSignIn();
          return;
        }
        onConnectGated?.(player);
        openProfileModal("connect_gate");
        return;
      }
      setConnectModalPlayer(player);
      setConnectModalOpen(true);
    },
    [hasCompletedMatchProfile, onConnectGated, openProfileModal, playerToken, requireSignIn],
  );

  const handleShareIntro = useCallback(
    (nextPlayer: DirectoryPlayer) => {
      if (!matchProfile) {
        if (!playerToken) {
          requireSignIn();
          return;
        }
        window.alert("Create your match profile to connect.");
        return;
      }

      const recipientPhone = getSmsRecipient(nextPlayer.raw?.phone);
      if (!recipientPhone) {
        window.alert("This player doesn't have a valid mobile number available for SMS yet.");
        return;
      }

      const trimmedDisplayName = displayName.trim();
      const senderName = trimmedDisplayName.length ? trimmedDisplayName : "TTP Player";
      const senderLevel = matchProfile?.level ?? null;
      const preferredTimes = formatAvailabilityList(matchProfile?.availability ?? []);
      // Without a rating we say nothing about level rather than claiming one.
      const selfIntro = senderLevel
        ? `My name is ${senderName} and I'm a ${senderLevel} player looking to hit ${preferredTimes}`
        : `My name is ${senderName} and I'm looking to hit ${preferredTimes}`;
      const message =
        `Hi ${nextPlayer.name}, I found you on the Tennis Plan App. ${selfIntro} at one of our local courts. ` +
        `You can check out my profile here: ${profileShareUrl}. ` +
        "Let me know if you'd like to hit sometime.";

      window.location.assign(buildSmsUrl(recipientPhone, message));
    },
    [displayName, matchProfile, playerToken, profileShareUrl, requireSignIn],
  );

  const handleCreateMatchPlayIntent = useCallback(
    (nextPlayer: DirectoryPlayer) => {
      if (!matchProfile) {
        if (!playerToken) {
          requireSignIn();
          return;
        }
        window.alert("Create your match profile to start building MatchPlay invites.");
        return;
      }

      const connectIntent: ConnectIntent = {
        invitee: {
          id: nextPlayer.id,
          name: nextPlayer.name,
          avatarUrl: nextPlayer.profileImageUrl,
          level: nextPlayer.level,
        },
        senderName: displayName.trim() || "You",
        senderLevel: matchProfile.level ?? undefined,
        suggestedAvailability: [...(matchProfile.availability ?? [])],
        preferredCourt: matchProfile.localCourts?.trim() ? matchProfile.localCourts.trim() : null,
        source,
      };

      navigate("/matches/create", { state: { connectIntent } });
      closeConnectModal();
    },
    [closeConnectModal, displayName, matchProfile, navigate, playerToken, requireSignIn, source],
  );

  const smsRecipient = connectModalPlayer ? getSmsRecipient(connectModalPlayer.raw?.phone) : null;

  const modals = (
    <>
      <ConnectPlayerModal
        isOpen={isConnectModalOpen}
        player={connectModalPlayer}
        onClose={closeConnectModal}
        canShareIntro={Boolean(smsRecipient)}
        shareIntroDescription={
          smsRecipient
            ? "Open a text message with this player's number and your profile details prefilled."
            : "This player doesn't have a valid mobile number available for SMS yet."
        }
        onShareIntro={() => {
          if (connectModalPlayer) {
            onConnectSent?.(connectModalPlayer, "sms_intro");
            closeConnectModal();
            handleShareIntro(connectModalPlayer);
          }
        }}
        onCreateMatch={() => {
          if (connectModalPlayer) {
            onConnectSent?.(connectModalPlayer, "match_invite");
            handleCreateMatchPlayIntent(connectModalPlayer);
          }
        }}
        senderAvailability={matchProfile?.availability ?? []}
        senderCourts={matchProfile?.localCourts ?? ""}
      />

      <MatchProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        initialProfile={matchProfile}
        onComplete={(profileDetails) => {
          const normalizedProfile = sanitizeMatchProfile(profileDetails) ?? profileDetails;
          setMatchProfile(normalizedProfile);
          setHasIncompleteMatchProfile(false);
          setMatchProfileCheckLoaded(true);
          storeMatchProfile(normalizedProfile);
          onProfileCompleted?.(promptTrigger);
          setPromptTrigger(null);
          setProfileModalOpen(false);
          window.alert(
            "Your match profile is live! You agree to share your contact details with other members and accept our terms. You can remove yourself from player matching anytime in settings.",
          );
        }}
      />
    </>
  );

  return {
    playerToken,
    displayName,
    matchProfile,
    hasIncompleteMatchProfile,
    matchProfileCheckLoaded,
    hasCompletedMatchProfile,
    requireSignIn,
    openConnect,
    openProfileModal,
    modals,
  };
}
