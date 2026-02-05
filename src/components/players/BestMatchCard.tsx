import React from "react";

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

interface BestMatchCardProps {
  player: Player;
  onConnect: () => void;
  onViewProfile: () => void;
  isMobile: boolean;
}

const BestMatchCard: React.FC<BestMatchCardProps> = ({
  player,
  onConnect,
  onViewProfile,
  isMobile,
}) => {
  return (
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
          background: "linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)",
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
            <img
              src={player.photo || player.avatarUrl}
              alt={player.name}
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                objectFit: "cover",
                border: "2px solid white",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontSize: "15px", fontWeight: 600, color: "#111827" }}>{player.name}</span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "white",
                    backgroundColor: "#7C3AED",
                    padding: "2px 8px",
                    borderRadius: "12px",
                  }}
                >
                  NTRP {player.ntrp}
                </span>
                {player.isVerified && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6" fill="#ECFDF5" stroke="#A7F3D0" />
                    <path d="M10 5L6 9L4 7" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
                {player.court || player.courts?.[0]}
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
              onClick={onConnect}
              style={{
                flex: 1,
                padding: "8px 16px",
                backgroundColor: "#7C3AED",
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
          <img
            src={player.photo || player.avatarUrl}
            alt={player.name}
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid white",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            }}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontSize: "15px", fontWeight: 600, color: "#111827" }}>{player.name}</span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "white",
                  backgroundColor: "#7C3AED",
                  padding: "2px 8px",
                  borderRadius: "12px",
                }}
              >
                NTRP {player.ntrp}
              </span>
              {player.isVerified && (
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
                    <path
                      d="M8 3L4 7L2 5"
                      stroke="#059669"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
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
              {player.court || player.courts?.[0]}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <button
              onClick={onConnect}
              style={{
                padding: "8px 16px",
                backgroundColor: "#7C3AED",
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
};

export default BestMatchCard;
