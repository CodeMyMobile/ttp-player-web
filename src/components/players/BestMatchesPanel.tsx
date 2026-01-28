import React from "react";
import BestMatchCard from "./BestMatchCard";

interface Player {
  id?: string;
  name: string;
  photo?: string;
  avatarUrl?: string;
  ntrp: string;
  isVerified?: boolean;
  court?: string;
  courts?: string[];
  matchScore: number;
  matchReasons: string[];
}

interface BestMatchesPanelProps {
  matches: Player[];
  onClose: () => void;
  onConnect: (player: Player) => void;
  onViewProfile: (player: Player) => void;
  isMobile: boolean;
}

const BestMatchesPanel: React.FC<BestMatchesPanelProps> = ({
  matches,
  onClose,
  onConnect,
  onViewProfile,
  isMobile,
}) => {
  return (
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
                fill="#7C3AED"
              />
            </svg>
          </div>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: isMobile ? "15px" : "16px",
                fontWeight: 600,
                color: "#111827",
              }}
            >
              Your Best Matches
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: isMobile ? "12px" : "13px", color: "#6B7280" }}>
              {isMobile ? "Matched by skill, availability & location" : "Players matched by skill level, availability, location & play style"}
            </p>
          </div>
        </div>

        <button
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
          style={{
            padding: "6px 14px",
            backgroundColor: "white",
            color: "#7C3AED",
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
};

export default BestMatchesPanel;
