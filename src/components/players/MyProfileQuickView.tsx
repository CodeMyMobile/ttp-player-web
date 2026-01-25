import React from "react";

interface MyProfileQuickViewProps {
  user: {
    name: string;
    photo?: string;
    avatarUrl?: string;
    ntrp: string;
    isVerified?: boolean;
    verificationCount?: number;
    tagline?: string;
    bio?: string;
    availability?: string[];
    courts?: string[];
  };
  onEdit: () => void;
  onRequestVerification: () => void;
  isMobile: boolean;
}

const MyProfileQuickView: React.FC<MyProfileQuickViewProps> = ({
  user,
  onEdit,
  onRequestVerification,
  isMobile,
}) => {
  const isVerified = user?.isVerified ?? false;
  const verificationCount = user?.verificationCount ?? 2;
  const verificationsNeeded = 3;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        alignItems: isMobile ? "center" : "flex-start",
        justifyContent: "space-between",
        gap: "24px",
        padding: isMobile ? "16px" : "20px 24px",
        backgroundColor: "#F5F3FF",
        borderRadius: "12px",
        border: "1px solid #E9E3FF",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "center" : "flex-start",
          gap: "16px",
          flex: 1,
          textAlign: isMobile ? "center" : "left",
        }}
      >
        <img
          src={user.photo || user.avatarUrl}
          alt={user.name}
          style={{
            width: isMobile ? "72px" : "64px",
            height: isMobile ? "72px" : "64px",
            borderRadius: "50%",
            objectFit: "cover",
            border: "3px solid white",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: "4px",
              justifyContent: isMobile ? "center" : "flex-start",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: 600,
                color: "#111827",
              }}
            >
              {user.name}
            </h3>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 10px",
                  backgroundColor: "#7C3AED",
                  color: "white",
                  fontSize: "12px",
                  fontWeight: 500,
                  borderRadius: "20px",
                }}
              >
                NTRP {user.ntrp}
              </span>

              {isVerified && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "4px 10px",
                    backgroundColor: "#ECFDF5",
                    color: "#059669",
                    fontSize: "12px",
                    fontWeight: 500,
                    borderRadius: "20px",
                    border: "1px solid #A7F3D0",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight: 4 }}>
                    <path
                      d="M10 3L4.5 8.5L2 6"
                      stroke="#059669"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Verified rating
                </span>
              )}
            </div>
          </div>

          <p
            style={{
              margin: "0 0 12px 0",
              fontSize: "14px",
              color: "#6B7280",
            }}
          >
            {user.tagline || user.bio}
          </p>

          {!isVerified && (
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                alignItems: isMobile ? "stretch" : "center",
                justifyContent: "space-between",
                gap: isMobile ? "12px" : "16px",
                padding: "12px 16px",
                backgroundColor: "#FFFBEB",
                borderRadius: "8px",
                border: "1px solid #FDE68A",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  flex: isMobile ? "none" : 1,
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    backgroundColor: "#FEF3C7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 1L10.163 5.279L15 6.026L11.5 9.421L12.326 14.236L8 12.013L3.674 14.236L4.5 9.421L1 6.026L5.837 5.279L8 1Z"
                      stroke="#F59E0B"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div>
                  <span
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#92400E",
                    }}
                  >
                    Get your rating verified
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#B45309",
                    }}
                  >
                    {verificationCount} of {verificationsNeeded} player confirmations
                  </span>
                </div>

                {!isMobile && (
                  <div style={{ flex: 1, maxWidth: "120px" }}>
                    <div
                      style={{
                        height: "6px",
                        backgroundColor: "#FDE68A",
                        borderRadius: "3px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${(verificationCount / verificationsNeeded) * 100}%`,
                          backgroundColor: "#F59E0B",
                          borderRadius: "3px",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={onRequestVerification}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "8px 14px",
                  backgroundColor: "#F59E0B",
                  color: "white",
                  fontSize: "13px",
                  fontWeight: 500,
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  width: isMobile ? "100%" : "auto",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  style={{ marginRight: 6 }}
                >
                  <path
                    d="M12.25 8.75V11.0833C12.25 11.3928 12.1271 11.6895 11.9083 11.9083C11.6895 12.1271 11.3928 12.25 11.0833 12.25H2.91667C2.60725 12.25 2.3105 12.1271 2.09171 11.9083C1.87292 11.6895 1.75 11.3928 1.75 11.0833V8.75"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9.91667 4.66667L7 1.75L4.08333 4.66667"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M7 1.75V8.75"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Request verification
              </button>
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              gap: isMobile ? "16px" : "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                alignItems: isMobile ? "center" : "flex-start",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: "#9CA3AF",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                }}
              >
                AVAILABILITY
              </span>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  justifyContent: isMobile ? "center" : "flex-start",
                }}
              >
                {user.availability?.map((slot, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "4px 10px",
                      backgroundColor: "white",
                      color: "#374151",
                      fontSize: "12px",
                      fontWeight: 500,
                      borderRadius: "20px",
                      border: "1px solid #E5E7EB",
                    }}
                  >
                    {slot}
                  </span>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                alignItems: isMobile ? "center" : "flex-start",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: "#9CA3AF",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                }}
              >
                LOCAL COURTS
              </span>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  alignItems: isMobile ? "center" : "flex-start",
                }}
              >
                {user.courts?.map((court, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      fontSize: "13px",
                      color: "#4B5563",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
                      <path
                        d="M7 1.16667C4.42 1.16667 2.33333 3.25334 2.33333 5.83334C2.33333 9.04167 7 12.8333 7 12.8333C7 12.8333 11.6667 9.04167 11.6667 5.83334C11.6667 3.25334 9.58 1.16667 7 1.16667Z"
                        stroke="#6B7280"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="7" cy="5.83333" r="1.75" stroke="#6B7280" strokeWidth="1.2" />
                    </svg>
                    <span>{court}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: isMobile ? "16px" : "0", width: isMobile ? "100%" : "auto" }}>
        <button
          onClick={onEdit}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 20px",
            backgroundColor: "white",
            color: "#7C3AED",
            fontSize: "14px",
            fontWeight: 500,
            borderRadius: "8px",
            border: "1px solid #E5E7EB",
            cursor: "pointer",
            width: isMobile ? "100%" : "auto",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: 6 }}>
            <path
              d="M11.333 2.00004C11.5081 1.82494 11.7169 1.68605 11.9471 1.59129C12.1773 1.49653 12.4244 1.44775 12.6738 1.44775C12.9232 1.44775 13.1703 1.49653 13.4005 1.59129C13.6307 1.68605 13.8395 1.82494 14.0147 2.00004C14.1898 2.17513 14.3287 2.38398 14.4234 2.61417C14.5182 2.84436 14.567 3.09145 14.567 3.34087C14.567 3.59029 14.5182 3.83738 14.4234 4.06757C14.3287 4.29776 14.1898 4.50661 14.0147 4.6817L5.00001 13.6964L1.33334 14.6667L2.30368 11.0001L11.333 2.00004Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Edit profile
        </button>
      </div>
    </div>
  );
};

export default MyProfileQuickView;
