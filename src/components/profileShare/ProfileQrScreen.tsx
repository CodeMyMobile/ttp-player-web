import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { MapPin, Share2, X } from "lucide-react";

import { getPublicProfileCard, type PublicProfileCard } from "../../api/publicProfile";
import { buildProfileUrl, joinCourts } from "../../utils/publicProfileLink";
import { trapDialogKeys } from "./ShareProfileSheet";
import "./profileShare.css";

type PublicCard = Extract<PublicProfileCard, { private: false }>;

export interface ProfileQrScreenProps {
  slug: string;
  onClose: () => void;
  onShareLink: () => void;
}

type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

/**
 * Keeps the screen on while someone scans. The lock drops whenever the page is hidden,
 * so it is asked for again on return. Unsupported browsers just behave as before.
 */
function useScreenWakeLock() {
  useEffect(() => {
    const wakeLock = (navigator as WakeLockNavigator).wakeLock;
    if (!wakeLock) return undefined;
    let sentinel: WakeLockSentinelLike | null = null;
    let released = false;
    const acquire = async () => {
      try {
        const next = await wakeLock.request("screen");
        if (released) await next.release();
        else sentinel = next;
      } catch {
        // Denied (low battery, not visible): the screen may dim, nothing else breaks.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => undefined);
    };
  }, []);
}

const ProfileQrScreen = ({ slug, onClose, onShareLink }: ProfileQrScreenProps) => {
  const screenRef = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState("");
  const [card, setCard] = useState<PublicCard | null>(null);
  const url = buildProfileUrl(slug);
  useScreenWakeLock();

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    screenRef.current?.querySelector<HTMLElement>(".pqr-close")?.focus();
    return () => opener?.focus?.();
  }, []);

  useEffect(() => {
    let cancelled = false;
    // High error correction: the logo covers the middle of the code.
    QRCode.toDataURL(url, { errorCorrectionLevel: "H", margin: 1, width: 560, color: { dark: "#1e1b4b", light: "#ffffff" } })
      .then((data) => {
        if (!cancelled) setQr(data);
      })
      .catch(() => undefined);
    getPublicProfileCard(slug)
      .then((result) => {
        if (!cancelled && !result.private) setCard(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [slug, url]);

  const courts = card ? joinCourts(card.home_courts) : "";

  return (
    <div
      ref={screenRef}
      className="pqr-screen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pqr-title"
      onKeyDown={(event) => trapDialogKeys(event, screenRef.current, onClose)}
    >
      <button type="button" className="pqr-close" aria-label="Close QR code" onClick={onClose}>
        <X size={22} aria-hidden="true" />
      </button>
      <p className="pqr-hint" id="pqr-title">
        Scan to see my Tennis Plan profile
      </p>

      <div className="pqr-card">
        <div className="pqr-code">
          {qr ? <img src={qr} alt={`QR code for ${url}`} /> : <span className="pqr-code__loading">Making your code…</span>}
          {qr ? <img className="pqr-logo" src="/icon-192.png" alt="" aria-hidden="true" /> : null}
        </div>
        <div className="pqr-who">
          <strong>{card?.display_name ?? ""}</strong>
          {card?.rating ? <span className="pshare-rating">NTRP {card.rating}</span> : null}
        </div>
        {courts ? (
          <p className="pqr-courts">
            <MapPin size={14} aria-hidden="true" />
            {courts}
          </p>
        ) : null}
      </div>

      <button type="button" className="pqr-share" onClick={onShareLink}>
        <Share2 size={18} aria-hidden="true" />
        Share link instead
      </button>
    </div>
  );
};

export default ProfileQrScreen;
