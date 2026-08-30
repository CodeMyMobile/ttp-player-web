/// <reference types="google.maps" />

import Autocomplete from "react-google-autocomplete";
import { X } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { readViewerId } from "../hooks/useHomeStatus";

import MainLayout from "../components/MainLayout";
import ResultsHeader from "../components/coaches/ResultsHeader";
import PlayersFilterBar from "../components/players/PlayersFilterBar";
import PlayerCard from "../components/players/PlayerCard";
import PlayerCardSkeleton from "../components/players/PlayerCardSkeleton";
import MatchProfileModal from "../components/players/MatchProfileModal";
import ConnectPlayerModal from "../components/players/ConnectPlayerModal";
import StateBanner from "../components/coaches/StateBanner";
import { colors, typography, warmPalette } from "../lib/theme";
import {
  getAllSurveyQuestionAnswered,
  fetchPlayerDetails,
  getPublicSuggestedPlayerCheckLocation,
  getSuggestedPlayerCheckLocation,
} from "../api/playerHome";
import { getStoredAuthToken } from "../services/authToken";
import type { Player } from "../data/mockPlayers";
import {
  extractSuggestedPlayer,
  mapSuggestedPlayer,
  toInitials,
  type DirectoryPlayer,
  type SuggestedPlayerRecord,
} from "../utils/suggestedPlayer";
import {
  DEFAULT_POSITION,
  getStoredLocation,
  storeLocation,
  USER_LOCATION_CHANGED_EVENT,
  type Coordinates,
} from "../utils/userLocation";
import usePlayerIdentity from "../hooks/usePlayerIdentity";
import PlayersFilterSheet from "../components/players/PlayersFilterSheet";
import { ChoosingExplainerSheet, TickExplainerSheet } from "../components/players/ExplainerSheets";
import CuratedStamp from "../components/CuratedStamp";
import { isCurated, rankPlayers } from "../utils/playerRanking";
import {
  activeChips,
  clearFilter,
  countNonDefault,
  filtersEqual,
  resetToDefaults,
  type FilterKey,
  type PlayerFilterState,
} from "../utils/playerFilters";
import {
  ANALYTICS_EVENTS,
  RANKING_VERSION_NONE,
  VENUE_MATCH_LABEL,
  track,
} from "../utils/analytics";
import { levelNumber, nearLevelRange, rankableLevelOptions } from "../utils/levelScope";
import { handleImageTransformError, sizedImageUrl } from "../utils/playerImage";
import type { ConnectIntent } from "../types/matchPlay";
import {
  buildMatchProfileFromSurvey,
  ensureStringArray,
  getStoredMatchProfile,
  hasIncompleteMatchProfileQuestions,
  sanitizeMatchProfile,
  storeMatchProfile,
  toCanonicalAvailability,
  type StoredMatchProfile,
} from "../utils/matchProfile";
import { buildSmsUrl, getSmsRecipient } from "../utils/smsLink";

import "../components/coaches/coaches.css";
import "../components/players/players.css";

type Mode = "normal" | "empty" | "error";
type Status = "loading" | "ready";

type SelectedLocation = {
  label: string;
  latitude: number;
  longitude: number;
  isCurrentLocation?: boolean;
};

const radiusOptions =["5 mi", "10 mi", "15 mi", "20 mi", "All"];
const levelOptions = ["All levels", "2.5", "3.0", "3.5", "4.0", "4.5+"];
const genderOptions = ["All genders", "Male", "Female", "Other"];
const playTypeOptions = ["All play types", "Singles", "Doubles", "Mixed", "Social"];
const availabilityOptions = ["All availability", "Weekdays AM", "Weekday PM", "Weekends"];

const normalize = (value: string) => value.trim().toLowerCase();

const SHEET_DEFAULTS: PlayerFilterState = {
  radius: radiusOptions[1],
  level: levelOptions[0],
  gender: genderOptions[0],
  playType: playTypeOptions[0],
  availability: availabilityOptions[0],
  verifiedOnly: false,
};

type PlayerFilters = {
  searchTerm: string;
  level: string;
  gender: string;
  playType: string;
  availability: string;
  verifiedOnly: boolean;
};

const DEFAULT_PLAYER_FILTERS: PlayerFilters = {
  searchTerm: "",
  level: levelOptions[0],
  gender: genderOptions[0],
  playType: playTypeOptions[0],
  availability: availabilityOptions[0],
  verifiedOnly: false,
};

// Module level and pure so the same rules can be applied speculatively — see countMatching.
const playerMatchesFilters = (player: DirectoryPlayer, filters: PlayerFilters) => {
  const normalizedTerm = normalize(filters.searchTerm);
  const matchesSearch =
    !normalizedTerm ||
    [
      player.name,
      player.location,
      player.bio,
      player.lookingFor,
      ...player.availability,
      ...player.matchPreferences,
      ...player.localCourts,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedTerm);

  const matchesLevel =
    filters.level === levelOptions[0] ||
    (filters.level === "4.5+"
      ? Number.parseFloat(player.level) >= 4.5
      : player.level === filters.level);

  const matchesGender =
    filters.gender === genderOptions[0] || normalize(player.gender) === normalize(filters.gender);

  const matchesPlayType =
    filters.playType === playTypeOptions[0] ||
    player.matchPreferences.some((preference) => normalize(preference).includes(normalize(filters.playType)));

  const matchesAvailability =
    filters.availability === availabilityOptions[0] ||
    player.availability.some(
      (slot) => normalize(toCanonicalAvailability(slot)) === normalize(filters.availability),
    );

  const matchesVerification = !filters.verifiedOnly || player.verified;

  return (
    matchesSearch && matchesLevel && matchesGender && matchesPlayType && matchesAvailability && matchesVerification
  );
};

const countActiveFilters = (filters: PlayerFilters, radius: string) =>
  (Object.keys(DEFAULT_PLAYER_FILTERS) as Array<keyof PlayerFilters>).filter(
    (key) => filters[key] !== DEFAULT_PLAYER_FILTERS[key],
  ).length + (radius === radiusOptions[1] ? 0 : 1);


const parseRadius = (radius: string) => {
  if (radius === "All") {
    return Number.POSITIVE_INFINITY;
  }
  const match = /^(\d+)/.exec(radius);
  return match ? Number.parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
};

const formatCoordinatesLabel =(coords: Coordinates | null) => {
  if (!coords) {
    return "";
  }

  const latitude = Math.abs(coords.latitude).toFixed(2);
  const longitude = Math.abs(coords.longitude).toFixed(2);
  const latHemisphere = coords.latitude >= 0 ? "N" : "S";
  const lonHemisphere = coords.longitude >= 0 ? "E" : "W";

  return `${latitude}° ${latHemisphere}, ${longitude}° ${lonHemisphere}`;
};

const sanitizeLocationLabel = (label: string) => label.replace(/\s+/g, " ").trim().toLowerCase();

const buildLocationSearch = (location: SelectedLocation | null): string => {
  if (!location) {
    return "";
  }

  if (location.isCurrentLocation) {
    return "";
  }

  const label = location.label?.trim();
  if (!label) {
    return "";
  }

  const normalized = sanitizeLocationLabel(label);
  if (!normalized || normalized === "current location") {
    return "";
  }

  return label;
};

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

const extractSuggestedPlayers =(payload: unknown): SuggestedPlayerRecord[] => {
  if (Array.isArray(payload)) {
    return payload as SuggestedPlayerRecord[];
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.data)) {
      return record.data as SuggestedPlayerRecord[];
    }
    if (Array.isArray(record.players)) {
      return record.players as SuggestedPlayerRecord[];
    }
    if (Array.isArray(record.results)) {
      return record.results as SuggestedPlayerRecord[];
    }
  }
  return [];
};

const toCourtList = (value: string | string[] | undefined): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim().length > 0) as string[];
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
};

const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < breakpoint);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [breakpoint]);

  return isMobile;
};


type BestMatchPlayer = DirectoryPlayer & {
  matchScore: number;
  matchReasons: string[];
};

const renderAvatar = (
  avatarUrl: string | undefined,
  initials: string,
  label: string,
  size: string,
  borderWidth: string,
) => {
  if (avatarUrl) {
    return (
      <img
        src={sizedImageUrl(avatarUrl, { size: Number.parseInt(size, 10) || 48 })}
        onError={(event) => handleImageTransformError(event, avatarUrl)}
        alt={label}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          border: `${borderWidth} solid white`,
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
        }}
      />
    );
  }

  return (
    <div
      aria-label={label}
      role="img"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: "#EDE9FE",
        color: "#6D28D9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "14px",
        fontWeight: 600,
        border: `${borderWidth} solid white`,
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
      }}
    >
      {initials}
    </div>
  );
};



type BestMatchCTAProps = {
  onClick: () => void;
  isMobile: boolean;
};

const BestMatchCTA = ({ onClick, isMobile }: BestMatchCTAProps) => (
  <div
    style={{
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "center",
      justifyContent: "space-between",
      gap: "20px",
      padding: isMobile ? "16px" : "20px 24px",
      background: "linear-gradient(135deg, var(--color-primary-dark) 0%, #9333EA 100%)",
      borderRadius: "12px",
      boxShadow: "0 4px 20px rgba(124, 58, 237, 0.3)",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        marginBottom: isMobile ? "14px" : "0",
      }}
    >
      <div
        style={{
          width: isMobile ? "40px" : "48px",
          height: isMobile ? "40px" : "48px",
          borderRadius: "12px",
          backgroundColor: "rgba(255, 255, 255, 0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width={isMobile ? "20" : "24"} height={isMobile ? "20" : "24"} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L14.944 8.062L21.656 9.018L16.828 13.698L17.888 20.382L12 17.262L6.112 20.382L7.172 13.698L2.344 9.018L9.056 8.062L12 2Z"
            fill="white"
          />
        </svg>
      </div>

      <div>
        <h4 style={{ margin: 0, fontSize: isMobile ? "16px" : "18px", fontWeight: 700, color: "white" }}>
          Find your perfect tennis partner
        </h4>
        <p style={{ margin: "2px 0 0 0", fontSize: isMobile ? "13px" : "14px", color: "rgba(255, 255, 255, 0.85)" }}>
          We&apos;ll match you based on skill, availability &amp; location
        </p>
      </div>
    </div>

    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? "14px 20px" : "14px 24px",
        backgroundColor: "white",
        color: "var(--color-primary-dark)",
        fontSize: "15px",
        fontWeight: 600,
        borderRadius: "10px",
        border: "none",
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        width: isMobile ? "100%" : "auto",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ marginRight: 8 }}>
        <path
          d="M9 1L11.472 6.008L17 6.808L13 10.698L13.944 16.2L9 13.608L4.056 16.2L5 10.698L1 6.808L6.528 6.008L9 1Z"
          fill="currentColor"
        />
      </svg>
      Find my best match
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 8 }}>
        <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  </div>
);

type BestMatchesPanelProps = {
  matches: BestMatchPlayer[];
  onClose: () => void;
  onConnect: (player: DirectoryPlayer) => void;
  onViewProfile: (player: DirectoryPlayer) => void;
  isMobile: boolean;
};

const BestMatchesPanel = ({
  matches,
  onClose,
  onConnect,
  onViewProfile,
  isMobile,
}: BestMatchesPanelProps) => (
  <div
    style={{
      backgroundColor: "white",
      borderRadius: "12px",
      border: "2px solid #E9D5FF",
      marginBottom: "20px",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        padding: isMobile ? "14px 16px" : "16px 20px",
        background: "linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)",
        borderBottom: "1px solid #E9D5FF",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            width: isMobile ? "36px" : "40px",
            height: isMobile ? "36px" : "40px",
            borderRadius: "10px",
            backgroundColor: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(124, 58, 237, 0.15)",
          }}
        >
          <svg width={isMobile ? "18" : "20"} height={isMobile ? "18" : "20"} viewBox="0 0 20 20" fill="none">
            <path
              d="M10 1L12.163 5.279L17 6.026L13.5 9.421L14.326 14.236L10 12.013L5.674 14.236L6.5 9.421L3 6.026L7.837 5.279L10 1Z"
              style={{ fill: "var(--color-primary-dark)" }}
            />
          </svg>
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: isMobile ? "15px" : "16px", fontWeight: 600, color: "#111827" }}>
            Your Best Matches
          </h3>
          <p style={{ margin: "2px 0 0 0", fontSize: isMobile ? "12px" : "13px", color: "#6B7280" }}>
            {isMobile
              ? "Matched by skill, availability & location"
              : "Players matched by skill level, availability, location & play style"}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "8px",
          backgroundColor: "white",
          border: "1px solid #E5E7EB",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M12 4L4 12M4 4L12 12" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>

    <div
      style={{
        padding: isMobile ? "12px" : "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {matches.map((player, idx) => (
        <BestMatchCard
          key={player.id || idx}
          player={player}
          onConnect={() => onConnect(player)}
          onViewProfile={() => onViewProfile(player)}
          isMobile={isMobile}
        />
      ))}
    </div>

    <div
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        gap: isMobile ? "10px" : "12px",
        padding: isMobile ? "12px 16px" : "14px 20px",
        backgroundColor: "#F9FAFB",
        borderTop: "1px solid #E5E7EB",
      }}
    >
      <span style={{ fontSize: "13px", color: "#6B7280" }}>Want better matches?</span>
      <button
        type="button"
        style={{
          padding: "6px 14px",
          backgroundColor: "white",
          color: "var(--color-primary-dark)",
          fontSize: "13px",
          fontWeight: 500,
          borderRadius: "6px",
          border: "1px solid #E9D5FF",
          cursor: "pointer",
          width: isMobile ? "100%" : "auto",
        }}
      >
        Complete your profile
      </button>
    </div>
  </div>
);

type BestMatchCardProps = {
  player: BestMatchPlayer;
  onConnect: () => void;
  onViewProfile: () => void;
  isMobile: boolean;
};

const BestMatchCard = ({ player, onConnect, onViewProfile, isMobile }: BestMatchCardProps) => (
  <div
    style={{
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "center",
      gap: "14px",
      padding: isMobile ? "16px 14px 14px" : "14px 16px",
      paddingTop: isMobile ? "20px" : "14px",
      backgroundColor: "#FAFAFA",
      borderRadius: "10px",
      border: "1px solid #E5E7EB",
      position: "relative",
    }}
  >
    <div
      style={{
        position: "absolute",
        top: "-8px",
        left: "16px",
        display: "flex",
        alignItems: "baseline",
        gap: "2px",
        padding: "4px 10px",
        background: "linear-gradient(135deg, var(--color-primary-dark) 0%, #9333EA 100%)",
        borderRadius: "12px",
        boxShadow: "0 2px 6px rgba(124, 58, 237, 0.3)",
      }}
    >
      <span style={{ fontSize: "13px", fontWeight: 700, color: "white" }}>{player.matchScore}%</span>
      <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.8)" }}>match</span>
    </div>

    {isMobile ? (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {renderAvatar(
            player.profileImageUrl || undefined,
            player.initials || toInitials(player.name),
            player.name,
            "48px",
            "2px",
          )}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontSize: "15px", fontWeight: 600, color: "#111827" }}>{player.name}</span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "white",
                  backgroundColor: "var(--color-primary-dark)",
                  padding: "2px 8px",
                  borderRadius: "12px",
                }}
              >
                NTRP {player.level}
              </span>
              {player.verified && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" fill="#ECFDF5" stroke="#A7F3D0" />
                  <path
                    d="M10 5L6 9L4 7"
                    stroke="#059669"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", fontSize: "12px", color: "#6B7280" }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight: 4 }}>
                <path
                  d="M6 1C3.79 1 2 2.79 2 5C2 7.75 6 11 6 11C6 11 10 7.75 10 5C10 2.79 8.21 1 6 1Z"
                  stroke="#9CA3AF"
                  strokeWidth="1.2"
                />
                <circle cx="6" cy="5" r="1.5" stroke="#9CA3AF" strokeWidth="1.2" />
              </svg>
              {player.favoriteCourt || player.localCourts?.[0]}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", margin: "12px 0" }}>
          {player.matchReasons?.map((reason, ridx) => (
            <span
              key={ridx}
              style={{
                display: "inline-flex",
                alignItems: "center",
                fontSize: "11px",
                color: "#059669",
                backgroundColor: "#ECFDF5",
                padding: "3px 8px",
                borderRadius: "10px",
                border: "1px solid #A7F3D0",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginRight: 4 }}>
                <path d="M8 3L4 7L2 5" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {reason}
            </span>
          ))}
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={onConnect}
            style={{
              flex: 1,
              padding: "8px 16px",
              backgroundColor: "var(--color-primary-dark)",
              color: "white",
              fontSize: "13px",
              fontWeight: 500,
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Connect
          </button>
          <button
            type="button"
            onClick={onViewProfile}
            style={{
              flex: 1,
              padding: "8px 16px",
              backgroundColor: "white",
              color: "#374151",
              fontSize: "13px",
              fontWeight: 500,
              borderRadius: "6px",
              border: "1px solid #E5E7EB",
              cursor: "pointer",
            }}
          >
            View
          </button>
        </div>
      </>
    ) : (
      <>
        {renderAvatar(
          player.profileImageUrl || undefined,
          player.initials || toInitials(player.name),
          player.name,
          "52px",
          "2px",
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span style={{ fontSize: "15px", fontWeight: 600, color: "#111827" }}>{player.name}</span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 500,
                color: "white",
                backgroundColor: "var(--color-primary-dark)",
                padding: "2px 8px",
                borderRadius: "12px",
              }}
            >
              NTRP {player.level}
            </span>
            {player.verified && (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" fill="#ECFDF5" stroke="#A7F3D0" />
                <path d="M10 5L6 9L4 7" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "6px" }}>
            {player.matchReasons?.map((reason, ridx) => (
              <span
                key={ridx}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: "11px",
                  color: "#059669",
                  backgroundColor: "#ECFDF5",
                  padding: "3px 8px",
                  borderRadius: "10px",
                  border: "1px solid #A7F3D0",
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginRight: 4 }}>
                  <path d="M8 3L4 7L2 5" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {reason}
              </span>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", fontSize: "12px", color: "#6B7280" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight: 4 }}>
              <path
                d="M6 1C3.79 1 2 2.79 2 5C2 7.75 6 11 6 11C6 11 10 7.75 10 5C10 2.79 8.21 1 6 1Z"
                stroke="#9CA3AF"
                strokeWidth="1.2"
              />
              <circle cx="6" cy="5" r="1.5" stroke="#9CA3AF" strokeWidth="1.2" />
            </svg>
            {player.favoriteCourt || player.localCourts?.[0]}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <button
            type="button"
            onClick={onConnect}
            style={{
              padding: "8px 16px",
              backgroundColor: "var(--color-primary-dark)",
              color: "white",
              fontSize: "13px",
              fontWeight: 500,
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Connect
          </button>
          <button
            type="button"
            onClick={onViewProfile}
            style={{
              padding: "8px 16px",
              backgroundColor: "white",
              color: "#374151",
              fontSize: "13px",
              fontWeight: 500,
              borderRadius: "6px",
              border: "1px solid #E5E7EB",
              cursor: "pointer",
            }}
          >
            View
          </button>
        </div>
      </>
    )}
  </div>
);

const FindPlayersPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  // Applied is what the results reflect. Draft is what the sheet is editing and
  // commits nothing until Apply — five of these used to take effect on the tap that
  // set them, which cannot work behind a sheet that covers the results.
  const [appliedFilters, setAppliedFilters] = useState<PlayerFilterState>(SHEET_DEFAULTS);
  const [draftFilters, setDraftFilters] = useState<PlayerFilterState>(SHEET_DEFAULTS);
  const [isSheetOpen, setSheetOpen] = useState(false);
  const filtersButtonRef = useRef<HTMLButtonElement | null>(null);

  const selectedRadius = appliedFilters.radius;
  const appliedRadius = appliedFilters.radius;
  const selectedLevel = appliedFilters.level;
  const selectedGender = appliedFilters.gender;
  const selectedPlayType = appliedFilters.playType;
  const selectedAvailability = appliedFilters.availability;
  const verifiedOnly = appliedFilters.verifiedOnly;
  const [players, setPlayers] = useState<DirectoryPlayer[]>([]);
  const [mode, setMode] = useState<Mode>("normal");
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [matchProfile, setMatchProfile] = useState<StoredMatchProfile | null>(() => getStoredMatchProfile());
  const [hasIncompleteMatchProfile, setHasIncompleteMatchProfile] = useState(false);
  const [matchProfileCheckLoaded, setMatchProfileCheckLoaded] = useState(false);
  const [connectModalPlayer, setConnectModalPlayer] = useState<DirectoryPlayer | null>(null);
  const [isConnectModalOpen, setConnectModalOpen] = useState(false);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [playerToken] = useState(() =>
    getStoredAuthToken({ defaultScheme: "token", preferScheme: "token" }) ?? undefined,
  );
  const hasMatchProfile = Boolean(matchProfile);
  const hasCompletedMatchProfile = hasMatchProfile && matchProfileCheckLoaded && !hasIncompleteMatchProfile;
  const hasProfile = hasCompletedMatchProfile;
  const { user } = useAuth();
  const { displayName } = usePlayerIdentity();
  const storedLocation = useMemo(() => getStoredLocation(), []);
  const [position, setPosition] = useState<Coordinates | null>(storedLocation);
  const [locationFilter, setLocationFilter] = useState<SelectedLocation | null>(null);
  const [locationSearchTerm, setLocationSearchTerm] = useState("");
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "ready" | "error">(
    storedLocation ? "ready" : "idle",
  );
  const [resolvedLocationLabel, setResolvedLocationLabel] = useState<string>(() =>
    storedLocation ? formatCoordinatesLabel(storedLocation) : "",
  );

  const requireSignIn = useCallback(() => {
    navigate("/login", { state: { from: location } });
  }, [location, navigate]);

  useEffect(() => {
    const syncStoredLocation = () => {
      const nextLocation = getStoredLocation();
      if (!nextLocation) return;

      setPosition(nextLocation);
      setLocationFilter(null);
      setResolvedLocationLabel(formatCoordinatesLabel(nextLocation));
      setLocationStatus("ready");
      setGeoError("");
    };

    window.addEventListener(USER_LOCATION_CHANGED_EVENT, syncStoredLocation);
    return () => window.removeEventListener(USER_LOCATION_CHANGED_EVENT, syncStoredLocation);
  }, []);

  useEffect(() => {
    let cancelled = false;

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
  }, [playerToken]);

  const positionKey = position ? `${position.latitude.toFixed(4)}:${position.longitude.toFixed(4)}` : "none";
  const locationQuery = buildLocationSearch(locationFilter);
  const hasSearchLocation = Boolean(position || locationFilter);
  const locationLabel = (() => {
    if (locationFilter) {
      return locationFilter.label;
    }

    if (locationStatus === "loading") {
      return "Locating…";
    }

    if (locationStatus === "error") {
      return "Location unavailable";
    }

    if (locationStatus === "ready") {
      if (resolvedLocationLabel) {
        return resolvedLocationLabel;
      }
      if (position) {
        return formatCoordinatesLabel(position) || "Current location";
      }
      return "Current location";
    }

    return resolvedLocationLabel || "";
  })();

  const applyLocationFilter = useCallback(
    (nextLocation: SelectedLocation | null) => {
      if (nextLocation) {
        const hasCoords =
          typeof nextLocation.latitude === "number" && typeof nextLocation.longitude === "number";

        if (hasCoords) {
          const coords: Coordinates = {
            latitude: nextLocation.latitude,
            longitude: nextLocation.longitude,
          };
          setPosition(coords);
          storeLocation(coords);
        } else {
          setPosition(null);
          storeLocation(null);
        }

        if (nextLocation.isCurrentLocation) {
          setLocationFilter(null);
        } else {
          setLocationFilter({ ...nextLocation, isCurrentLocation: false });
        }

        setResolvedLocationLabel(nextLocation.label);
        setLocationStatus("ready");
        setLocationSearchTerm(nextLocation.label);
        setGeoError("");
        setShowLocationPicker(false);
        setMode("normal");
        return;
      }

      setLocationFilter(null);
      setLocationSearchTerm("");
      setGeoError("");
      setShowLocationPicker(false);
      setMode("normal");
      setResolvedLocationLabel("");
      setLocationStatus("idle");
      setPosition(null);
      storeLocation(null);
    },
    [setMode],
  );

  const detectCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      const message = "Location detection is not supported in this browser.";
      setGeoError(message);
      setLocationStatus("error");
      setResolvedLocationLabel("");
      return;
    }

    setIsDetectingLocation(true);
    setLocationStatus("loading");
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (nextPosition) => {
        setIsDetectingLocation(false);
        const coords: Coordinates = {
          latitude: nextPosition.coords.latitude,
          longitude: nextPosition.coords.longitude,
        };
        setPosition(coords);
        storeLocation(coords);
        setLocationFilter(null);
        setResolvedLocationLabel(formatCoordinatesLabel(coords));
        setLocationStatus("ready");
        setLocationSearchTerm("");
      },
      (error) => {
        setIsDetectingLocation(false);
        console.error("Failed to detect current location", error);
        const message =
          error.message || "We couldn't detect your location. Please allow access and try again.";
        setGeoError(message);
        setLocationStatus("error");
        setResolvedLocationLabel("");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }, []);

  const hasLocationFilter = Boolean(locationFilter);

  const closeLocationPicker = useCallback(() => {
    setShowLocationPicker(false);
    setGeoError("");
    setLocationSearchTerm(locationFilter?.label ?? "");
  }, [locationFilter?.label]);

  useEffect(() => {
    if (!position && locationStatus === "idle" && !isDetectingLocation) {
      detectCurrentLocation();
    }
  }, [position, locationStatus, isDetectingLocation, detectCurrentLocation]);

  useEffect(() => {
    if (!position || locationFilter) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const lookupLocationName = async () => {
      try {
        const query = new URLSearchParams({
          format: "jsonv2",
          lat: position.latitude.toString(),
          lon: position.longitude.toString(),
        });

        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?${query.toString()}`,
          {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("Failed to lookup location");
        }

        const data = await response.json();
        if (cancelled) {
          return;
        }

        const address = (data?.address ?? {}) as Record<string, unknown>;
        const locality =
          (address.city as string | undefined) ||
          (address.town as string | undefined) ||
          (address.village as string | undefined) ||
          (address.hamlet as string | undefined) ||
          (address.suburb as string | undefined) ||
          (address.county as string | undefined);
        const region = (address.state as string | undefined) || (address.region as string | undefined);
        const countryCode =
          typeof address.country_code === "string" ? address.country_code.toUpperCase() : null;

        const labelParts = [locality, region, countryCode].filter(Boolean) as string[];
        const resolvedLabel = labelParts.length
          ? labelParts.join(", ")
          : (data?.display_name as string | undefined)?.split(",").slice(0, 2).join(", ") || "";

        setResolvedLocationLabel(resolvedLabel || formatCoordinatesLabel(position));
      } catch (lookupError) {
        if (cancelled) {
          return;
        }
        console.error("Failed to resolve location", lookupError);
        setResolvedLocationLabel(formatCoordinatesLabel(position));
      }
    };

    lookupLocationName();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [position, locationFilter]);

  useEffect(() => {
    let isCancelled = false;

    if (playerToken && !matchProfileCheckLoaded) {
      setPlayers([]);
      setStatus("loading");
      setMode("normal");
      setError(null);
      return undefined;
    }

    if (!hasSearchLocation) {
      setPlayers([]);
      setStatus("ready");
      setMode("empty");
      setError(null);
      return undefined;
    }

    const fetchPlayers = async () => {
      setStatus("loading");
      setError(null);
      try {
        const radiusValue = parseRadius(appliedRadius);
        const requestParams = {
          perPage: 20,
          page: 1,
          search: appliedSearchTerm,
          location: locationQuery || undefined,
          radius: Number.isFinite(radiusValue) ? radiusValue : undefined,
          position: position
            ? { latitude: position.latitude, longitude: position.longitude }
            : undefined,
        };
        const response = playerToken
          ? await getSuggestedPlayerCheckLocation({
              token: playerToken,
              ...requestParams,
            })
          : await getPublicSuggestedPlayerCheckLocation(requestParams);
        if (isCancelled) {
          return;
        }
        const suggestedPlayers = extractSuggestedPlayers(response);
        const mapped = suggestedPlayers.map(mapSuggestedPlayer);
        setPlayers(mapped);
        setMode(mapped.length > 0 ? "normal" : "empty");
      } catch (requestError) {
        if (isCancelled) {
          return;
        }
        setPlayers([]);
        setMode("error");
        setError(
          requestError instanceof Error
            ? requestError.message
            : "We couldn\'t load suggested players right now.",
        );
      } finally {
        if (!isCancelled) {
          setStatus("ready");
        }
      }
    };

    fetchPlayers();

    return () => {
      isCancelled = true;
    };
  }, [
    playerToken,
    appliedSearchTerm,
    appliedRadius,
    locationQuery,
    positionKey,
    hasIncompleteMatchProfile,
    matchProfileCheckLoaded,
    hasSearchLocation,
  ]);

  const themeVars = useMemo(
    () => ({
      // Warm neutrals. The existing --fc-* names are kept so nothing downstream has to
      // change; only what they resolve to does.
      "--fc-color-bg": warmPalette.ground,
      "--fc-color-surface": warmPalette.surface,
      "--fc-color-text-primary": warmPalette.ink,
      "--fc-color-text-secondary": warmPalette.muted,
      "--fc-color-text-muted": warmPalette.inkSecondary,
      "--fc-color-border": warmPalette.line,
      "--fc-color-icon": warmPalette.faint,
      // accent = fills only; accent-ink = every piece of text. See warmPalette.
      "--fc-color-accent": warmPalette.accent,
      "--fc-color-accent-ink": warmPalette.accentInk,
      "--fc-color-accent-light": warmPalette.accentSoft,
      "--fc-color-accent-border": warmPalette.accentLine,
      "--fc-color-on-accent": warmPalette.onAccent,
      "--fc-chip-bg": warmPalette.surfaceMuted,
      "--fc-chip-hover-bg": warmPalette.lineSoft,
      "--fc-chip-text": warmPalette.inkSecondary,
      "--fc-color-panel": warmPalette.panel,
      "--fc-color-surface-muted": warmPalette.surfaceMuted,
      "--fc-color-line-soft": warmPalette.lineSoft,
      "--fc-color-good": warmPalette.good,
      "--fc-color-good-soft": warmPalette.goodSoft,
      "--fc-color-good-line": warmPalette.goodLine,
      "--fc-color-seal": warmPalette.seal,
      "--fc-color-warm": warmPalette.warm,
      "--fc-color-warm-soft": warmPalette.warmSoft,
      "--fc-color-secondary-border": warmPalette.line,
      "--fc-color-secondary-text": warmPalette.inkSecondary,
      "--fc-color-secondary-hover": warmPalette.lineSoft,
      // Success reuses the palette's `good`, so the confirmed-rating tick and every
      // other affirmative mark are one colour.
      "--fc-color-success": warmPalette.good,
      "--fc-color-success-hover": colors.primarySuccessHover,
      // Error stays semantic — there is no warm red, and a warmed one would read as a
      // warning rather than an error.
      "--fc-color-error-bg": colors.errorBg,
      "--fc-color-error-border": colors.errorBorder,
      "--fc-color-error-text": colors.errorText,
      // Neutrals warm up with everything else; a cool skeleton against a warm ground
      // reads as a rendering fault.
      "--fc-color-empty-icon-bg": warmPalette.surfaceMuted,
      "--fc-color-skeleton-base": warmPalette.line,
      "--fc-color-skeleton-highlight": warmPalette.lineSoft,
      "--fc-font-family": typography.fontFamily,
      "--fc-heading-size": typography.heading1.size,
      "--fc-heading-line-height": typography.heading1.lineHeight,
      "--fc-body-size": typography.body.size,
      "--fc-body-line-height": typography.body.lineHeight,
    }),
    [],
  );

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

  // Identical properties on connect_clicked and connect_sent, so the two are directly
  // comparable and the gap between them reads as the gate's conversion rate.
  // These sit above their consumers on purpose. `filteredPlayers` is read inside
  // useCallback/useEffect DEPENDENCY ARRAYS below, and a dependency array is evaluated
  // during render — so declaring it later throws
  // "Cannot access 'filteredPlayers' before initialization" and the page renders
  // nothing at all. The build cannot catch it: there is no TypeScript compiler here and
  // a temporal dead zone violation is a runtime error.
  const activeFilters: PlayerFilters = useMemo(
    () => ({
      searchTerm: appliedSearchTerm,
      level: selectedLevel,
      gender: selectedGender,
      playType: selectedPlayType,
      availability: selectedAvailability,
      verifiedOnly,
    }),
    [appliedSearchTerm, selectedLevel, selectedGender, selectedPlayType, selectedAvailability, verifiedOnly],
  );

  const viewerTier = useMemo(() => {
    if (!playerToken) return "signed_out";
    // Relies on level being null when absent rather than defaulted to "3.0".
    return matchProfile?.level ? "member" : "no_level";
  }, [playerToken, matchProfile]);

  // The viewer's position on the page's own level ladder. levelNumber is used only to
  // find which rung they are on; the range itself is ordinal.
  const viewerLadderLevel = useMemo(() => {
    const value = levelNumber(matchProfile?.level ?? null);
    if (value === null) return null;
    return rankableLevelOptions(levelOptions).find((option) => levelNumber(option) === value) ?? null;
  }, [matchProfile]);

  const nearRange = useMemo(
    () => nearLevelRange(rankableLevelOptions(levelOptions), viewerLadderLevel),
    [viewerLadderLevel],
  );

  const viewerCourts = useMemo(
    () => toCourtList(matchProfile?.localCourts).map(normalize),
    [matchProfile],
  );

  const filteredPlayers = useMemo(
    () => (mode === "normal" ? players.filter((player) => playerMatchesFilters(player, activeFilters)) : []),
    [mode, players, activeFilters],
  );

  // Same predicate, run against a hypothetical filter set, so an analytics event can
  // report the result count a change WILL produce without duplicating the rules.
  const countMatching = useCallback(
    (overrides: Partial<PlayerFilters>) =>
      mode === "normal"
        ? players.filter((player) => playerMatchesFilters(player, { ...activeFilters, ...overrides })).length
        : 0,
    [mode, players, activeFilters],
  );

  const buildConnectProps = useCallback(
    (player: DirectoryPlayer, position: number | null) => ({
      position: typeof position === "number" ? position + 1 : null,
      resultCount: filteredPlayers.length,
      rankingVersion: RANKING_VERSION_NONE,
      inRange: nearRange.length > 0 ? nearRange.includes(player.level) : null,
      viewerTier,
      targetConfirmed: Boolean(player.verified),
      targetConfirmationCount: player.verificationCount ?? 0,
      targetHasPhoto: Boolean(player.profileImageUrl),
      sameCourt: player.localCourts.some((court) => viewerCourts.includes(normalize(court))),
      venueMatch: VENUE_MATCH_LABEL,
    }),
    [filteredPlayers.length, nearRange, viewerCourts, viewerTier],
  );

  const trackPromptShown = useCallback(
    (trigger: string) => {
      if (shownPrompts.current.has(trigger)) return;
      shownPrompts.current.add(trigger);
      track(ANALYTICS_EVENTS.profilePromptShown, { trigger, viewerTier });
    },
    [viewerTier],
  );
  const openProfileModal = useCallback(
    (trigger: string) => {
      setPromptTrigger(trigger);
      track(ANALYTICS_EVENTS.profilePromptClicked, { trigger, viewerTier });
      setProfileModalOpen(true);
    },
    [viewerTier],
  );

  const openConnectModalForPlayer = useCallback(
    (player: DirectoryPlayer, position?: number) => {
      // Intent, not completion — the gate may still intercept, and the player may
      // close the modal. connect_sent is the completed action.
      track(ANALYTICS_EVENTS.connectClicked, buildConnectProps(player, position ?? null));
      setConnectModalPosition(typeof position === "number" ? position : null);

      if (!hasCompletedMatchProfile) {
        if (!playerToken) {
          requireSignIn();
          return;
        }
        trackPromptShown("connect_gate");
        openProfileModal("connect_gate");
        return;
      }
      setConnectModalPlayer(player);
      setConnectModalOpen(true);
    },
    [buildConnectProps, hasCompletedMatchProfile, openProfileModal, playerToken, requireSignIn, trackPromptShown],
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
        source: "find-players",
      };

      navigate("/matches/create", { state: { connectIntent } });
      closeConnectModal();
    },
    [closeConnectModal, displayName, matchProfile, navigate, playerToken, requireSignIn],
  );

  const shownPrompts = useRef<Set<string>>(new Set());
  const viewedFired = useRef(false);
  const pendingFilterEvent = useRef<{ filter: string; value: string; before: number } | null>(null);
  const [promptTrigger, setPromptTrigger] = useState<string | null>(null);
  const [connectModalPosition, setConnectModalPosition] = useState<number | null>(null);

  const activeFilterCount = useMemo(
    () => countActiveFilters(activeFilters, selectedRadius),
    [activeFilters, selectedRadius],
  );

  // Once per page view, not per render.
  useEffect(() => {
    if (status !== "ready" || viewedFired.current) return;
    viewedFired.current = true;
    track(ANALYTICS_EVENTS.findPlayersViewed, {
      viewerTier,
      resultCount: filteredPlayers.length,
      filtersActive: activeFilterCount,
      rankingVersion: RANKING_VERSION_NONE,
    });
  }, [status, viewerTier, filteredPlayers.length, activeFilterCount]);

  // Distance and search are resolved server-side, so their "after" count is only known
  // once new results land. Park the event and flush it when they do.
  useEffect(() => {
    const pending = pendingFilterEvent.current;
    if (!pending || status !== "ready") return;
    pendingFilterEvent.current = null;
    track(ANALYTICS_EVENTS.filtersApplied, {
      filter: pending.filter,
      value: pending.value,
      resultCountBefore: pending.before,
      resultCountAfter: filteredPlayers.length,
    });
  }, [status, filteredPlayers.length]);


  const trackClientFilter = useCallback(
    (filter: string, value: string, overrides: Partial<PlayerFilters>) => {
      track(ANALYTICS_EVENTS.filtersApplied, {
        filter,
        value,
        resultCountBefore: filteredPlayers.length,
        resultCountAfter: countMatching(overrides),
      });
    },
    [filteredPlayers.length, countMatching],
  );

  const chips = useMemo(
    () =>
      activeChips(appliedFilters, SHEET_DEFAULTS, {
        viewerLevel: matchProfile?.level ?? null,
        nearRange,
      }),
    [appliedFilters, matchProfile, nearRange],
  );

  const openSheet = useCallback(() => {
    setDraftFilters(appliedFilters);
    setSheetOpen(true);
  }, [appliedFilters]);

  // Scrim, Escape and the close button all discard: the draft is thrown away and the
  // applied state is untouched.
  const dismissSheet = useCallback(() => {
    setDraftFilters(appliedFilters);
    setSheetOpen(false);
    filtersButtonRef.current?.focus();
  }, [appliedFilters]);

  const applySheet = useCallback(() => {
    if (!filtersEqual(draftFilters, appliedFilters)) {
      const before = filteredPlayers.length;
      setAppliedFilters(draftFilters);
      pendingFilterEvent.current = { filter: "sheet", value: "apply", before };
      if (draftFilters.radius !== appliedFilters.radius) setMode("normal");
    }
    setSheetOpen(false);
    filtersButtonRef.current?.focus();
  }, [draftFilters, appliedFilters, filteredPlayers.length]);

  const [openExplainer, setOpenExplainer] = useState<null | "tick" | "choosing">(null);

  // Dismissal persists per player: someone who has read it once should not be asked
  // again on every visit. Keyed by viewer so a shared device does not inherit it.
  const stripKey = useMemo(() => `player:web:tick-strip-dismissed:${readViewerId(user) ?? "anon"}`, [user]);
  const [stripDismissed, setStripDismissed] = useState(() => {
    try {
      return localStorage.getItem(stripKey) === "1";
    } catch {
      return false;
    }
  });

  const dismissStrip = useCallback(() => {
    setStripDismissed(true);
    try {
      localStorage.setItem(stripKey, "1");
    } catch {
      // A refusal to persist is not a reason to keep showing it this session.
    }
  }, [stripKey]);

  const openExplainerFrom = useCallback(
    (which: "tick" | "choosing", source: "strip" | "card_tick" | "why") => {
      // The only way to learn whether the strip earns its space or whether every open
      // comes from a tick — which decides whether the strip should survive at all.
      track(ANALYTICS_EVENTS.explainerOpened, { explainer: which, source, viewerTier });
      setOpenExplainer(which);
    },
    [viewerTier],
  );

  const clearOneFilter = useCallback(
    (key: FilterKey) => {
      trackClientFilter(String(key), "cleared", {});
      setAppliedFilters((current) => clearFilter(current, SHEET_DEFAULTS, key));
      if (key === "radius") setMode("normal");
    },
    [trackClientFilter],
  );


  const handleSearch = () => {
    // Whether a query was entered, never the query text itself.
    pendingFilterEvent.current = {
      filter: "search",
      value: String(Boolean(normalize(searchTerm))),
      before: filteredPlayers.length,
    };
    setAppliedSearchTerm(normalize(searchTerm));
    setMode("normal");
  };

  const handleRadiusChange = (radius: string) => {
    pendingFilterEvent.current = { filter: "distance", value: radius, before: filteredPlayers.length };
    setAppliedFilters((current) => ({ ...current, radius }));
    setMode("normal");
  };

  const handleLevelChange = (level: string) => {
    trackClientFilter("level", level, { level: level });
    setAppliedFilters((current) => ({ ...current, level: level }));
  };

  const handleGenderChange = (gender: string) => {
    trackClientFilter("gender", gender, { gender: gender });
    setAppliedFilters((current) => ({ ...current, gender: gender }));
  };

  const handlePlayTypeChange = (playType: string) => {
    trackClientFilter("style", playType, { playType: playType });
    setAppliedFilters((current) => ({ ...current, playType: playType }));
  };

  const handleAvailabilityChange = (availability: string) => {
    trackClientFilter("when", availability, { availability: availability });
    setAppliedFilters((current) => ({ ...current, availability: availability }));
  };

  const handleVerifiedToggle = (next: boolean) => {
    trackClientFilter("confirmed", String(next), { verifiedOnly: next });
    setAppliedFilters((current) => ({ ...current, verifiedOnly: next }));
  };

  const resetFilters = () => {
    setSearchTerm("");
    setAppliedSearchTerm("");
    setAppliedFilters(resetToDefaults(SHEET_DEFAULTS));
    setMode("normal");
  };
;

  // The viewer's OWN confirmation status, read from their own player record — the same
  // isLevelConfirmed field every other player carries, via the same endpoint. This is
  // deliberately NOT /player/verification-level, which is a stub returning
  // `level: 'Verified'` for everyone; trusting it would mark the whole directory
  // confirmed. Defaults to false, so a failed or pending fetch hedges the verdict
  // rather than overstating it.
  const [viewerConfirmed, setViewerConfirmed] = useState(false);

  useEffect(() => {
    const viewerId = readViewerId(user);
    if (!playerToken || !viewerId) {
      setViewerConfirmed(false);
      return undefined;
    }
    let cancelled = false;
    fetchPlayerDetails({ token: playerToken, userId: viewerId })
      .then((payload) => {
        if (cancelled) return;
        const record = extractSuggestedPlayer(payload);
        setViewerConfirmed(Boolean(record?.isLevelConfirmed));
      })
      .catch(() => {
        if (!cancelled) setViewerConfirmed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerToken, user]);

  // What the card needs to describe the match as a relationship rather than a list.
  const cardViewer = useMemo(
    () => ({
      level: matchProfile?.level ?? null,
      confirmed: viewerConfirmed,
      courts: toCourtList(matchProfile?.localCourts),
      availability: (matchProfile?.availability ?? []).map((slot) => toCanonicalAvailability(slot)),
    }),
    [matchProfile, viewerConfirmed],
  );

  // Ranking runs only when there is something personal to rank against. Without a
  // level the heaviest signal is missing and the order would be arbitrary dressed up
  // as a recommendation.
  const rankingRan = Boolean(hasProfile && cardViewer.level);

  const orderedPlayers = useMemo(
    () => (rankingRan ? rankPlayers(filteredPlayers, cardViewer) : filteredPlayers),
    [rankingRan, filteredPlayers, cardViewer],
  );

  const filtersUntouched = useMemo(
    () => filtersEqual(appliedFilters, SHEET_DEFAULTS) && !appliedSearchTerm,
    [appliedFilters, appliedSearchTerm],
  );

  const curated = useMemo(
    () =>
      isCurated({
        hasProfile: Boolean(hasProfile),
        hasLevel: Boolean(cardViewer.level),
        filtersUntouched,
        rankingRan,
        resultCount: orderedPlayers.length,
      }),
    [hasProfile, cardViewer.level, filtersUntouched, rankingRan, orderedPlayers.length],
  );

  // Shown instead of the curated header, never stacked on it, so it costs no height.
  const needsLevelPrompt =
    status === "ready" && mode === "normal" && !cardViewer.level && orderedPlayers.length > 0;

  // The setup banners are persistently visible, so impressions are recorded once per
  // page view — per-render would drown every other event.
  useEffect(() => {
    if (status !== "ready") return;
    if (needsLevelPrompt) {
      trackPromptShown("prompt_header");
    }
  }, [status, needsLevelPrompt, trackPromptShown]);

  const shouldShowError = status === "ready" && mode === "error";
  const shouldShowEmpty =
    status === "ready" && (mode === "empty" || (mode === "normal" && filteredPlayers.length === 0));
  const shouldShowResults = status === "ready" && mode === "normal" && filteredPlayers.length > 0;

  const resultsCountLabel = (() => {
    if (status === "loading") {
      return "Matching you with players…";
    }
    if (shouldShowError) {
      return "Unable to load players";
    }
    if (shouldShowEmpty) {
      return "No players found";
    }
    if (shouldShowResults) {
      return `${filteredPlayers.length} ${filteredPlayers.length === 1 ? "player" : "players"} found`;
    }
    return "Matching you with players…";
  })();

  return (
    <MainLayout mobileChrome="home" desktopChrome="home" hideMobileNewMatch pageClassName="dashboard-page--find-players">
      <div className="find-players-page" style={themeVars}>
        <div className="find-players-page__inner">
          {/* The app bar already says Find Players and the subtitle restates it.
              Hidden on mobile, where the space is worth more than the repetition. */}
          <ResultsHeader
            title="Find Players"
            description="Connect with local players who match your level and style."
            mobileDescription="Connect with local players by level and style."
          />


          

          {!hasSearchLocation && matchProfileCheckLoaded && !hasIncompleteMatchProfile && (
            <StateBanner
              tone="empty"
              title="Location required"
              message="Choose a location or use your current location to search nearby players."
              action={
                <button
                  type="button"
                  className="fc-button fc-button--primary"
                  onClick={() => {
                    setGeoError("");
                    setShowLocationPicker(true);
                  }}
                >
                  Set search location
                </button>
              }
            />
          )}

          

          {/* Above the fold, in order: search + Filters, chips, result bar, cards. */}
          <div className="fp-controls">
            <div className="fp-controls__search">
              <input
                className="fc-filter__search-input fp-search-input"
                type="search"
                value={searchTerm}
                placeholder="Search players by name"
                aria-label="Search players by name"
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSearch();
                }}
              />
            </div>
            <button
              type="button"
              className="fp-filters-button"
              ref={filtersButtonRef}
              aria-haspopup="dialog"
              aria-expanded={isSheetOpen}
              onClick={openSheet}
            >
              Filters
              {activeFilterCount > 0 ? (
                <span className="fp-filters-button__count">{activeFilterCount}</span>
              ) : null}
            </button>
          </div>

          {chips.length > 0 ? (
            <div className="fp-chips" role="list" aria-label="Active filters">
              {chips.map((chip) => (
                <span className="fp-chip" role="listitem" key={chip.key}>
                  {chip.label}
                  <button
                    type="button"
                    className="fp-chip__clear"
                    aria-label={`Clear ${chip.label}`}
                    onClick={() => clearOneFilter(chip.key)}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <button type="button" className="fp-chip fp-chip--add" onClick={openSheet}>
                + Add filter
              </button>
            </div>
          ) : null}

          {needsLevelPrompt ? (
            // Replaces the curated header rather than stacking on it — and while it is
            // showing, the tick explainer stands down. One ask per screen.
            <section className="fp-prompt-header" aria-label="Add your level">
              <p className="fp-prompt-header__lead">
                {orderedPlayers.length} {orderedPlayers.length === 1 ? "player" : "players"} within{" "}
                {appliedFilters.radius}
              </p>
              <p className="fp-prompt-header__body">
                We can&rsquo;t tell which of them are a good hit for you until we know your level.
              </p>
              <button
                type="button"
                className="fp-prompt-header__cta"
                onClick={() => openProfileModal("prompt_header")}
              >
                Add my level
              </button>
            </section>
          ) : status === "ready" && mode === "normal" ? (
            <div className="fp-result-bar">
              {curated ? (
                <>
                  <CuratedStamp
                    subject="players"
                    // No count here: the result line below already carries it, and
                    // printing it twice is repetition, not emphasis.
                    basis="Ordered by shared courts, overlapping times and closeness of level."
                  />
                  <button
                    type="button"
                    className="fp-why-these"
                    onClick={() => openExplainerFrom("choosing", "why")}
                  >
                    Why these?
                  </button>
                </>
              ) : (
                <span>
                  {orderedPlayers.length} {orderedPlayers.length === 1 ? "player" : "players"} nearby
                </span>
              )}
            </div>
          ) : null}

          {/* Desktop keeps the filters inline — same controls, different container. */}
          <div className="fp-desktop-filters">
          <PlayersFilterBar
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            onSearch={handleSearch}
            locationLabel={locationLabel || "Select location"}
            onLocationClick={() => {
              setGeoError("");
              setShowLocationPicker((prev) => {
                if (!prev) {
                  setLocationSearchTerm("");
                }
                return !prev;
              });
            }}
            isLocationPickerOpen={showLocationPicker}
            radiusOptions={radiusOptions}
            selectedRadius={selectedRadius}
            onRadiusChange={handleRadiusChange}
            levelOptions={levelOptions}
            selectedLevel={selectedLevel}
            onLevelChange={handleLevelChange}
            genderOptions={genderOptions}
            selectedGender={selectedGender}
            onGenderChange={handleGenderChange}
            playTypeOptions={playTypeOptions}
            selectedPlayType={selectedPlayType}
            onPlayTypeChange={handlePlayTypeChange}
            availabilityOptions={availabilityOptions}
            selectedAvailability={selectedAvailability}
            onAvailabilityChange={handleAvailabilityChange}
            verifiedOnly={verifiedOnly}
            onVerifiedOnlyChange={handleVerifiedToggle}
          />
          </div>


          {showLocationPicker ? (
            <section className="fp-location-panel" id="player-location-picker" aria-label="Location picker">
              <Autocomplete
                apiKey={import.meta.env.VITE_GOOGLE_API_KEY || undefined}
                placeholder="Enter your location"
                className="fp-autocomplete-input"
                value={locationSearchTerm}
                onChange={(event) => setLocationSearchTerm(event.target.value)}
                onPlaceSelected={(place: google.maps.places.PlaceResult | null) => {
                  if (!place) {
                    setGeoError("Please choose a location from the suggestions.");
                    return;
                  }

                  const lat = place.geometry?.location?.lat?.();
                  const lng = place.geometry?.location?.lng?.();
                  const label =
                    place.formatted_address || place.name || locationSearchTerm || "Custom location";

                  if (
                    typeof lat === "number" &&
                    !Number.isNaN(lat) &&
                    typeof lng === "number" &&
                    !Number.isNaN(lng)
                  ) {
                    applyLocationFilter({ label, latitude: lat, longitude: lng });
                  } else {
                    setGeoError("We couldn't read that location's coordinates. Try another search.");
                  }
                }}
                options={{
                  types: ["geocode", "establishment"],
                  fields: ["formatted_address", "geometry", "name", "address_components"],
                  componentRestrictions: { country: "us" },
                }}
              />

              <div className="fp-location-actions">
                <button
                  type="button"
                  className="fp-location-detect"
                  onClick={detectCurrentLocation}
                  disabled={isDetectingLocation}
                >
                  {isDetectingLocation ? "Detecting location..." : "Use my current location"}
                </button>
                <div className="fp-location-secondary-actions">
                  {hasLocationFilter ? (
                    <button
                      type="button"
                      className="fp-location-secondary"
                      onClick={() => applyLocationFilter(null)}
                    >
                      Clear location
                    </button>
                  ) : null}
                  <button type="button" className="fp-location-secondary" onClick={closeLocationPicker}>
                    Close
                  </button>
                </div>
              </div>

              <div className="fp-location-summary">
                <h4>Selected location</h4>
                {locationFilter ? (
                  <p>{locationFilter.label}</p>
                ) : position ? (
                  <p>
                    Lat {position.latitude.toFixed(4)}, Lng {position.longitude.toFixed(4)}
                  </p>
                ) : (
                  <p>No location selected yet.</p>
                )}
              </div>

              {geoError ? <p className="fp-location-error">{geoError}</p> : null}
              {!import.meta.env.VITE_GOOGLE_API_KEY ? (
                <p className="fp-location-tip">
                  Tip: Provide a Google Places API key to enable location search suggestions.
                </p>
              ) : null}
            </section>
          ) : null}

          <span className="fc-results-count">{resultsCountLabel}</span>

          {status === "loading" && (
            <div className="players-results-grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <PlayerCardSkeleton key={index} />
              ))}
            </div>
          )}

          {shouldShowError && (
            <StateBanner
              tone="error"
              title="We couldn't load players right now"
              message={error ?? "Please try again in a few minutes or adjust your filters."}
              action={
                <button type="button" className="fc-button fc-button--primary" onClick={resetFilters}>
                  Retry search
                </button>
              }
            />
          )}

          {shouldShowEmpty && !shouldShowError && (
            <StateBanner
              tone="empty"
              title="No players match these filters"
              message="Broaden your distance, clear filters, or try searching by a different playing style."
              action={
                <button type="button" className="fc-button fc-button--secondary" onClick={resetFilters}>
                  Reset filters
                </button>
              }
            />
          )}

          {shouldShowResults && (
            <div className="players-results-grid">
              {orderedPlayers.map((player, index) => (
                <Fragment key={player.id}>
                <PlayerCard
                  topPick={curated && index === 0}
                  onExplainTick={() => openExplainerFrom("tick", "card_tick")}
                  player={player}
                  canConnect={hasCompletedMatchProfile}
                  viewer={cardViewer}
                  onConnect={(nextPlayer) => openConnectModalForPlayer(nextPlayer as DirectoryPlayer, index)}
                  onViewProfile={(nextPlayer) => {
                    navigate(`/players/${nextPlayer.id}`, {
                      state: { player: nextPlayer as DirectoryPlayer },
                    });
                  }}
                />

                {/* After the first card, not before it: it explains a mark the reader
                    has just seen. Stands down while the prompt header is showing —
                    one ask per screen. */}
                {index === 0 && !stripDismissed && !needsLevelPrompt ? (
                  <div className="fp-tick-strip">
                    <button
                      type="button"
                      className="fp-tick-strip__open"
                      onClick={() => openExplainerFrom("tick", "strip")}
                    >
                      What does the ✓ next to a rating mean?
                    </button>
                    <button
                      type="button"
                      className="fp-tick-strip__dismiss"
                      aria-label="Dismiss this explanation"
                      onClick={dismissStrip}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : null}
                </Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
      <ConnectPlayerModal
        isOpen={isConnectModalOpen}
        player={connectModalPlayer}
        onClose={closeConnectModal}
        canShareIntro={Boolean(connectModalPlayer && getSmsRecipient(connectModalPlayer.raw?.phone))}
        shareIntroDescription={
          connectModalPlayer && getSmsRecipient(connectModalPlayer.raw?.phone)
            ? "Open a text message with this player's number and your profile details prefilled."
            : "This player doesn't have a valid mobile number available for SMS yet."
        }
        onShareIntro={() => {
          if (connectModalPlayer) {
            track(ANALYTICS_EVENTS.connectSent, {
              ...buildConnectProps(connectModalPlayer, connectModalPosition),
              method: "sms_intro",
            });
            closeConnectModal();
            handleShareIntro(connectModalPlayer);
          }
        }}
        onCreateMatch={() => {
          if (connectModalPlayer) {
            track(ANALYTICS_EVENTS.connectSent, {
              ...buildConnectProps(connectModalPlayer, connectModalPosition),
              method: "match_invite",
            });
            handleCreateMatchPlayIntent(connectModalPlayer);
          }
        }}
        senderAvailability={matchProfile?.availability ?? []}
        senderCourts={matchProfile?.localCourts ?? ""}
      />

      <PlayersFilterSheet
        isOpen={isSheetOpen}
        draft={draftFilters}
        applied={appliedFilters}
        defaults={SHEET_DEFAULTS}
        groups={[
          { key: "radius", label: "Within", options: radiusOptions },
          { key: "level", label: "Level", options: levelOptions },
          { key: "availability", label: "When", options: availabilityOptions },
          { key: "playType", label: "Style", options: playTypeOptions },
          { key: "gender", label: "Gender", options: genderOptions },
        ]}
        countForDraft={countMatching({
          level: draftFilters.level,
          gender: draftFilters.gender,
          playType: draftFilters.playType,
          availability: draftFilters.availability,
          verifiedOnly: draftFilters.verifiedOnly,
        })}
        onDraftChange={(patch) => setDraftFilters((current) => ({ ...current, ...patch }))}
        onApply={applySheet}
        onDismiss={dismissSheet}
        onReset={() => setDraftFilters(resetToDefaults(SHEET_DEFAULTS))}
        onEditProfile={() => {
          setSheetOpen(false);
          openProfileModal("filter_sheet");
        }}
      />

      <TickExplainerSheet
        isOpen={openExplainer === "tick"}
        onDismiss={() => setOpenExplainer(null)}
        onConfirmMyLevel={() => {
          setOpenExplainer(null);
          navigate("/settings/match-profile");
        }}
      />

      <ChoosingExplainerSheet
        isOpen={openExplainer === "choosing"}
        onDismiss={() => setOpenExplainer(null)}
        onEditFilters={() => {
          setOpenExplainer(null);
          openSheet();
        }}
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
          track(ANALYTICS_EVENTS.matchProfileCompleted, { trigger: promptTrigger });
          setPromptTrigger(null);
          setProfileModalOpen(false);
          window.alert(
            "Your match profile is live! You agree to share your contact details with other members and accept our terms. You can remove yourself from player matching anytime in settings.",
          );
        }}
      />
    </MainLayout>
  );
};

export default FindPlayersPage;
