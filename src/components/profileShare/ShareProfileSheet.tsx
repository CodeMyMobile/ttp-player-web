import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { Copy, Check, MapPin, QrCode, Share2, X } from "lucide-react";

import { getPublicProfileCard, type PublicProfileCard } from "../../api/publicProfile";
import { buildProfileUrl, buildShareText, joinCourts } from "../../utils/publicProfileLink";
import { getAvatarInitials } from "../../play-dates/utils/avatar";
import "./profileShare.css";

type PublicCard = Extract<PublicProfileCard, { private: false }>;

export interface ShareProfileSheetProps {
  slug: string;
  onClose: () => void;
  onShowQr: () => void;
}

const COPIED_RESET_MS = 2000;

/** Copies `text`, falling back to a hidden textarea where the async clipboard is blocked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  }
}

/** Keeps Tab inside the dialog and closes it on Escape. */
export function trapDialogKeys(event: ReactKeyboardEvent, root: HTMLElement | null, onClose: () => void) {
  if (event.key === "Escape") {
    event.preventDefault();
    onClose();
    return;
  }
  if (event.key !== "Tab" || !root) return;
  const list = Array.from(
    root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])'),
  );
  if (!list.length) return;
  const first = list[0];
  const last = list[list.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

// The card shows exactly what a stranger opening the link sees, so it reads the
// public endpoint rather than the player's own (fuller) profile.
const ShareProfileSheet = ({ slug, onClose, onShowQr }: ShareProfileSheetProps) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState<PublicCard | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState("");
  const url = buildProfileUrl(slug);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    sheetRef.current?.querySelector<HTMLElement>(".pshare-close")?.focus();
    return () => opener?.focus?.();
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPublicProfileCard(slug)
      .then((result) => {
        if (cancelled) return;
        if (result.private) setLoadFailed(true);
        else setCard(result);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const copyLink = async () => {
    if (await copyText(url)) setCopied(true);
    else setToast("Couldn't copy. Press and hold the link to copy it.");
  };

  const shareLink = async () => {
    const text = buildShareText({ rating: card?.rating, homeCourts: card?.home_courts });
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "My Tennis Plan profile", text, url });
        return;
      } catch (error) {
        // The player closed the share menu: nothing to do.
        if ((error as DOMException)?.name === "AbortError") return;
      }
    }
    if (await copyText(url)) {
      setCopied(true);
      setToast("Link copied. Paste it anywhere to share.");
    } else {
      setToast("Couldn't copy. Press and hold the link to copy it.");
    }
  };

  const courts = card ? joinCourts(card.home_courts) : "";

  return (
    <div
      className="pshare-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        className="pshare-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pshare-title"
        onKeyDown={(event) => trapDialogKeys(event, sheetRef.current, onClose)}
      >
        <div className="pshare-handle" aria-hidden="true" />
        <div className="pshare-head">
          <h2 id="pshare-title">Share my profile</h2>
          <button type="button" className="pshare-close" aria-label="Close" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="pshare-card" aria-live="polite">
          {card ? (
            <>
              <span className="pshare-avatar" aria-hidden="true">
                {card.profile_picture ? <img src={card.profile_picture} alt="" /> : getAvatarInitials(card.display_name)}
              </span>
              <div className="pshare-card__body">
                <div className="pshare-card__name">
                  <strong>{card.display_name}</strong>
                  {card.rating ? <span className="pshare-rating">NTRP {card.rating}</span> : null}
                </div>
                {courts ? (
                  <p className="pshare-card__courts">
                    <MapPin size={14} aria-hidden="true" />
                    {courts}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <p className="pshare-card__status">
              {loadFailed ? "Your card couldn't load, but the link below still works." : "Loading your card…"}
            </p>
          )}
        </div>

        <div className="pshare-link">
          <label htmlFor="pshare-url" className="pshare-sr">
            Your profile link
          </label>
          <input id="pshare-url" type="text" value={url} readOnly onFocus={(event) => event.target.select()} />
          <button type="button" className="pshare-copy" onClick={copyLink} aria-live="polite">
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <button type="button" className="pshare-primary" onClick={shareLink}>
          <Share2 size={18} aria-hidden="true" />
          Share link
        </button>
        <button type="button" className="pshare-secondary" onClick={onShowQr}>
          <QrCode size={18} aria-hidden="true" />
          Show QR code
        </button>

        <p className="pshare-note">
          Anyone with the link sees your name, level and home courts. Contact details stay private.
        </p>
        {toast ? (
          <p className="pshare-toast" role="status">
            {toast}
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default ShareProfileSheet;
