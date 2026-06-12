/// <reference types="google.maps" />

import Autocomplete from "react-google-autocomplete";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import MainLayout from "../components/MainLayout";
import ResultsHeader from "../components/coaches/ResultsHeader";
import PlayersFilterBar from "../components/players/PlayersFilterBar";
import PlayerCard from "../components/players/PlayerCard";
import PlayerCardSkeleton from "../components/players/PlayerCardSkeleton";
import MatchProfileModal from "../components/players/MatchProfileModal";
import ConnectPlayerModal from "../components/players/ConnectPlayerModal";
import StateBanner from "../components/coaches/StateBanner";
import { colors, typography } from "../lib/theme";
import { getAllSurveyQuestionAnswered, getSuggestedPlayerCheckLocation } from "../api/playerHome";
import { getStoredAuthToken } from "../services/authToken";
import type { Player } from "../data/mockPlayers";
import {
  DEFAULT_POSITION,
  getStoredLocation,
  storeLocation,
  USER_LOCATION_CHANGED_EVENT,
  type Coordinates,
} from "../utils/userLocation";
import usePlayerIdentity from "../hooks/usePlayerIdentity";
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

type SuggestedPlayerRecord = {
  userId: number;
  email?: string;
  phone?: string;
  full_name?: string;
  profile_picture?: string;
  skillLevel?: string;
  availability?: string[] | string;
  playerLocations?: string[] | string;
  playerCourtLocations?: string[] | string;
  lookingFor?: string[] | string;
  gender?: string;
  about_me?: string;
  genderAdditionalText?: string;
  isLevelConfirmed?: boolean;
  verifiedLevelCount?: string | number;
  is_favorite?: boolean;
  [key: string]: unknown;
};

type DirectoryPlayer = Player & { raw: SuggestedPlayerRecord };

const radiusOptions = ["5 mi", "10 mi", "15 mi", "20 mi", "All"];
const levelOptions = ["All levels", "2.5", "3.0", "3.5", "4.0", "4.5+"];
const genderOptions = ["All genders", "Male", "Female", "Other"];
const playTypeOptions = ["All play types", "Singles", "Doubles", "Mixed", "Social"];
const availabilityOptions = ["All availability", "Weekdays AM", "Weekday PM", "Weekends"];

const normalize = (value: string) => value.trim().toLowerCase();

const parseRadius = (radius: string) => {
  if (radius === "All") {
    return Number.POSITIVE_INFINITY;
  }
  const match = /^(\d+)/.exec(radius);
  return match ? Number.parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
};

const toInitials = (name: string) => {
  const segments = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (segments.length === 0) {
    return "TP";
  }
  if (segments.length === 1) {
    return segments[0].slice(0, 2).toUpperCase();
  }
  return `${segments[0][0]}${segments[segments.length - 1][0]}`.toUpperCase();
};

const formatCoordinatesLabel = (coords: Coordinates | null) => {
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

const getSmsRecipient = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("@")) {
    return null;
  }

  const hasLeadingPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return null;
  }

  return hasLeadingPlus ? `+${digits}` : digits;
};

const buildSmsUrl = (recipient: string, message: string) => {
  const encodedMessage = encodeURIComponent(message);
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const separator = isIos ? "&" : "?";
  return `sms:${recipient}${separator}body=${encodedMessage}`;
};

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

const mapSuggestedPlayer = (record: SuggestedPlayerRecord): DirectoryPlayer => {
  const availability = ensureStringArray(record.availability, toCanonicalAvailability);
  const playerLocations = ensureStringArray(record.playerLocations);
  const courtLocations = ensureStringArray(record.playerCourtLocations);
  const lookingFor = ensureStringArray(record.lookingFor);
  const location = playerLocations[0] ?? courtLocations[0] ?? "Location unavailable";
  const initialsSource = record.full_name ?? record.email ?? "TTP Player";
  const skillLabel = typeof record.skillLevel === "string" ? record.skillLevel.trim() : "";
  const levelMatch = skillLabel.match(/NTRP\s*([0-9.]+)/i);
  const normalizedLevel = levelMatch?.[1] ?? (skillLabel || "Unknown");
  const verificationCount = Number.parseInt(String(record.verifiedLevelCount ?? "0"), 10) || 0;
  const normalizedGender = (() => {
    const rawGender = typeof record.gender === "string" ? record.gender.trim().toLowerCase() : "";
    if (rawGender === "male") return "Male" as const;
    if (rawGender === "female") return "Female" as const;
    return "Other" as const;
  })();
  const courts = courtLocations.length > 0 ? courtLocations : playerLocations;
  const bio = typeof record.about_me === "string" && record.about_me.trim().length > 0
    ? record.about_me.trim()
    : "This player hasn\'t added a bio yet.";

  return {
    id: String(record.userId ?? initialsSource.toLowerCase()),
    name: record.full_name?.trim() || record.email || "TTP Player",
    initials: toInitials(initialsSource),
    profileImageUrl:
      typeof record.profile_picture === "string" ? record.profile_picture.trim() : "",
    location,
    distanceMiles: 0,
    gender: normalizedGender,
    level: normalizedLevel,
    availability,
    matchPreferences: lookingFor,
    bio,
    verified: Boolean(record.isLevelConfirmed),
    verificationCount,
    verificationSupporters: [],
    lastActive: "Active recently",
    matchFrequency: "Match frequency unavailable",
    rating: 0,
    favoriteCourt: courts[0] ?? location,
    lookingFor: lookingFor.join(", ") || "Not specified",
    localCourts: courts,
    hitTypes: lookingFor,
    matchesPlayed: undefined,
    reviewsCount: undefined,
    responseTime: undefined,
    memberSince: undefined,
    matchHistory: undefined,
    reviews: undefined,
    raw: record,
  };
};

const extractSuggestedPlayers = (payload: unknown): SuggestedPlayerRecord[] => {
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

type ProfileQuickViewUser = {
  name: string;
  ntrp: string;
  initials?: string;
  tagline?: string;
  bio?: string;
  availability?: string[];
  courts?: string[];
  photo?: string;
  avatarUrl?: string;
  isVerified?: boolean;
  verificationCount?: number;
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
        src={avatarUrl}
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

type MyProfileQuickViewProps = {
  user: ProfileQuickViewUser;
  onEdit: () => void;
};

const MyProfileQuickView = ({ user, onEdit }: MyProfileQuickViewProps) => {
  const isVerified = user?.isVerified ?? false;
  const initials = user.initials || toInitials(user.name);
  const availability = user.availability?.length ? user.availability : ["Add availability"];
  const courts = user.courts?.length ? user.courts : ["Add local courts"];

  return (
    <section className="fp-profile-summary" aria-label="Your match profile">
      <div className="fp-profile-summary__primary">
        {renderAvatar(user.photo || user.avatarUrl, initials, user.name, "42px", "0")}
        <div className="fp-profile-summary__identity">
          <h2>{user.name}</h2>
          <div className="fp-profile-summary__badges">
            <span className="fp-pill fp-pill--purple">NTRP {user.ntrp}</span>
            {isVerified ? <span className="fp-pill fp-pill--green">Verified</span> : null}
          </div>
        </div>
      </div>

      <div className="fp-profile-summary__divider" aria-hidden="true" />

      <div className="fp-profile-summary__group">
        <span className="fp-profile-summary__label">Available</span>
        <div className="fp-profile-summary__chips">
          {availability.slice(0, 3).map((slot) => (
            <span className="fp-card__availability-chip" key={slot}>
              {slot}
            </span>
          ))}
        </div>
      </div>

      <div className="fp-profile-summary__divider" aria-hidden="true" />

      <div className="fp-profile-summary__group fp-profile-summary__group--courts">
        <span className="fp-profile-summary__label">Courts</span>
        <p>{courts.slice(0, 2).join(" · ")}</p>
      </div>

      <button type="button" className="fp-profile-summary__edit" onClick={onEdit}>
        Edit
      </button>
    </section>
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
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [selectedRadius, setSelectedRadius] = useState<string>(radiusOptions[1]);
  const [appliedRadius, setAppliedRadius] = useState<string>(radiusOptions[1]);
  const [selectedLevel, setSelectedLevel] = useState<string>(levelOptions[0]);
  const [selectedGender, setSelectedGender] = useState<string>(genderOptions[0]);
  const [selectedPlayType, setSelectedPlayType] = useState<string>(playTypeOptions[0]);
  const [selectedAvailability, setSelectedAvailability] = useState<string>(availabilityOptions[0]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
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

    if (!playerToken) {
      setPlayers([]);
      setStatus("ready");
      setMode("error");
      setError("Please sign in to search for players.");
      return undefined;
    }

    if (!matchProfileCheckLoaded) {
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
        const response = await getSuggestedPlayerCheckLocation({
          token: playerToken,
          perPage: 20,
          page: 1,
          search: appliedSearchTerm,
          location: locationQuery || undefined,
          radius: Number.isFinite(radiusValue) ? radiusValue : undefined,
          position: position
            ? { latitude: position.latitude, longitude: position.longitude }
            : undefined,
        });
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
      "--fc-color-bg": colors.pageBackground,
      "--fc-color-surface": colors.surface,
      "--fc-color-text-primary": colors.primaryText,
      "--fc-color-text-secondary": colors.secondaryText,
      "--fc-color-text-muted": colors.mutedText,
      "--fc-color-border": colors.border,
      "--fc-color-icon": colors.icon,
      "--fc-color-accent": colors.accentPurple,
      "--fc-color-accent-light": colors.accentPurpleLight,
      "--fc-color-accent-border": colors.accentPurpleBorder,
      "--fc-chip-bg": colors.filterChipBg,
      "--fc-chip-hover-bg": colors.filterChipHover,
      "--fc-chip-text": colors.secondaryButtonText,
      "--fc-color-secondary-border": colors.secondaryButtonBorder,
      "--fc-color-secondary-text": colors.secondaryButtonText,
      "--fc-color-secondary-hover": colors.secondaryButtonHover,
      "--fc-color-success": colors.primarySuccess,
      "--fc-color-success-hover": colors.primarySuccessHover,
      "--fc-color-error-bg": colors.errorBg,
      "--fc-color-error-border": colors.errorBorder,
      "--fc-color-error-text": colors.errorText,
      "--fc-color-empty-icon-bg": colors.emptyIconBg,
      "--fc-color-skeleton-base": colors.skeletonBase,
      "--fc-color-skeleton-highlight": colors.skeletonHighlight,
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

  const profileQuickViewUser = useMemo(() => {
    if (!matchProfile) {
      return null;
    }
    const trimmedName = displayName.trim();
    const name = trimmedName.length ? trimmedName : "TTP Player";
    return {
      name,
      initials: toInitials(name),
      ntrp: matchProfile.level ?? "3.0",
      tagline: matchProfile.about || "Add a quick bio to help players get to know you.",
      bio: matchProfile.about,
      availability: (matchProfile.availability ?? []).map((slot) => toCanonicalAvailability(slot)),
      courts: toCourtList(matchProfile.localCourts),
      isVerified: false,
      verificationCount: 2,
    };
  }, [displayName, matchProfile]);

  const closeConnectModal = useCallback(() => {
    setConnectModalOpen(false);
    setConnectModalPlayer(null);
  }, []);

  const openConnectModalForPlayer = useCallback(
    (player: DirectoryPlayer) => {
      if (!hasCompletedMatchProfile) {
        setProfileModalOpen(true);
        return;
      }
      setConnectModalPlayer(player);
      setConnectModalOpen(true);
    },
    [hasCompletedMatchProfile],
  );

  const handleShareIntro = useCallback(
    (nextPlayer: DirectoryPlayer) => {
      if (!matchProfile) {
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
      const senderLevel = matchProfile?.level ?? "3.0";
      const preferredTimes = formatAvailabilityList(matchProfile?.availability ?? []);
      const message =
        `Hi ${nextPlayer.name}, I found you on the Tennis Plan App. My name is ${senderName} and I'm a ${senderLevel} ` +
        `player looking to hit ${preferredTimes} at one of our local courts. You can check out my profile here: ${profileShareUrl}. ` +
        "Let me know if you'd like to hit sometime.";

      window.location.assign(buildSmsUrl(recipientPhone, message));
    },
    [displayName, matchProfile, profileShareUrl],
  );

  const handleCreateMatchPlayIntent = useCallback(
    (nextPlayer: DirectoryPlayer) => {
      if (!matchProfile) {
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
        senderLevel: matchProfile.level,
        suggestedAvailability: [...(matchProfile.availability ?? [])],
        preferredCourt: matchProfile.localCourts?.trim() ? matchProfile.localCourts.trim() : null,
        source: "find-players",
      };

      navigate("/matches/create", { state: { connectIntent } });
      closeConnectModal();
    },
    [closeConnectModal, displayName, matchProfile, navigate],
  );

  const handleSearch = () => {
    setAppliedSearchTerm(normalize(searchTerm));
    setMode("normal");
  };

  const handleRadiusChange = (radius: string) => {
    setSelectedRadius(radius);
    setAppliedRadius(radius);
    setMode("normal");
  };

  const handleLevelChange = (level: string) => {
    setSelectedLevel(level);
  };

  const handleGenderChange = (gender: string) => {
    setSelectedGender(gender);
  };

  const handlePlayTypeChange = (playType: string) => {
    setSelectedPlayType(playType);
  };

  const handleAvailabilityChange = (availability: string) => {
    setSelectedAvailability(availability);
  };

  const handleVerifiedToggle = (next: boolean) => {
    setVerifiedOnly(next);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setAppliedSearchTerm("");
    setSelectedRadius(radiusOptions[1]);
    setAppliedRadius(radiusOptions[1]);
    setSelectedLevel(levelOptions[0]);
    setSelectedGender(genderOptions[0]);
    setSelectedPlayType(playTypeOptions[0]);
    setSelectedAvailability(availabilityOptions[0]);
    setVerifiedOnly(false);
    setMode("normal");
  };

  const filteredPlayers = useMemo(() => {
    if (mode !== "normal") {
      return [];
    }

    const normalizedTerm = normalize(appliedSearchTerm);

    return players.filter((player) => {
      const matchesSearch = (() => {
        if (!normalizedTerm) {
          return true;
        }
        const haystack = [
          player.name,
          player.location,
          player.bio,
          player.lookingFor,
          ...player.availability,
          ...player.matchPreferences,
          ...player.localCourts,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedTerm);
      })();

      const matchesLevel =
        selectedLevel === "All levels" ||
        (selectedLevel === "4.5+"
          ? Number.parseFloat(player.level) >= 4.5
          : player.level === selectedLevel);

      const matchesGender =
        selectedGender === "All genders" || normalize(player.gender) === normalize(selectedGender);

      const matchesPlayType =
        selectedPlayType === "All play types" ||
        player.matchPreferences.some((preference) =>
          normalize(preference).includes(normalize(selectedPlayType)),
        );

      const matchesAvailability =
        selectedAvailability === "All availability" ||
        player.availability.some(
          (slot) => normalize(toCanonicalAvailability(slot)) === normalize(selectedAvailability),
        );

      const matchesVerification = !verifiedOnly || player.verified;

      return matchesSearch && matchesLevel && matchesGender && matchesPlayType && matchesAvailability && matchesVerification;
    });
  }, [
    mode,
    appliedSearchTerm,
    players,
    selectedGender,
    selectedLevel,
    selectedPlayType,
    selectedAvailability,
    verifiedOnly,
  ]);

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
          <ResultsHeader
            title="Find Players"
            description="Connect with local players who match your level and style."
            mobileDescription="Connect with local players by level and style."
            actionSlot={
              <button
                type="button"
                className="fc-button fc-button--secondary"
                onClick={() => setProfileModalOpen(true)}
              >
                {hasCompletedMatchProfile ? "Edit match profile" : "Create match profile"}
              </button>
            }
          />

          {hasProfile && profileQuickViewUser ? (
            <MyProfileQuickView
              user={profileQuickViewUser}
              onEdit={() => setProfileModalOpen(true)}
            />
          ) : null}

          {hasIncompleteMatchProfile && matchProfileCheckLoaded && (
            <section className="fp-profile-setup" aria-label="Set up your match profile">
              <div>
                <h2>Add your match profile</h2>
                <p>Share your level, availability and courts so players can find you too.</p>
              </div>
              <button type="button" onClick={() => setProfileModalOpen(true)}>
                Set up
              </button>
            </section>
          )}

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

          {!hasProfile && status === "ready" && mode !== "error" && !hasIncompleteMatchProfile && (
            <section className="fp-profile-setup" aria-label="Set up your match profile">
              <div>
                <h2>Add your match profile</h2>
                <p>Share your level, availability and courts so players can find you too.</p>
              </div>
              <button type="button" onClick={() => setProfileModalOpen(true)}>
                Set up
              </button>
            </section>
          )}

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
              {filteredPlayers.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  canConnect={hasCompletedMatchProfile}
                  onConnect={openConnectModalForPlayer}
                  onViewProfile={(nextPlayer) => {
                    navigate(`/players/${nextPlayer.id}`, {
                      state: { player: nextPlayer as DirectoryPlayer },
                    });
                  }}
                />
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
            closeConnectModal();
            handleShareIntro(connectModalPlayer);
          }
        }}
        onCreateMatch={() => {
          if (connectModalPlayer) {
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
