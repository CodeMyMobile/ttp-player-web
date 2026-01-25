import React from "react";

interface BestMatchCTAProps {
  onClick: () => void;
  isMobile: boolean;
}

const BestMatchCTA: React.FC<BestMatchCTAProps> = ({ onClick, isMobile }) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        alignItems: isMobile ? "stretch" : "center",
        justifyContent: "space-between",
        gap: "20px",
        padding: isMobile ? "16px" : "20px 24px",
        background: "linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)",
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
            <path d="M12 2L14.944 8.062L21.656 9.018L16.828 13.698L17.888 20.382L12 17.262L6.112 20.382L7.172 13.698L2.344 9.018L9.056 8.062L12 2Z" fill="white" />
          </svg>
        </div>

        <div>
          <h4
            style={{
              margin: 0,
              fontSize: isMobile ? "16px" : "18px",
              fontWeight: 700,
              color: "white",
            }}
          >
            Find your perfect tennis partner
          </h4>
          <p
            style={{
              margin: "2px 0 0 0",
              fontSize: isMobile ? "13px" : "14px",
              color: "rgba(255, 255, 255, 0.85)",
            }}
          >
            We'll match you based on skill, availability & location
          </p>
        </div>
      </div>

      <button
        onClick={onClick}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: isMobile ? "14px 20px" : "14px 24px",
          backgroundColor: "white",
          color: "#7C3AED",
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
          <path d="M9 1L11.472 6.008L17 6.808L13 10.698L13.944 16.2L9 13.608L4.056 16.2L5 10.698L1 6.808L6.528 6.008L9 1Z" fill="currentColor" />
        </svg>
        Find my best match
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 8 }}>
          <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
};

export default BestMatchCTA;
