import { Copy, Mail, MessageCircle, Send, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { buildSocialShareTargets } from "../utils/shareLinks";
import "./SocialShareButtons.css";

type SocialShareButtonsProps = {
  title: string;
  text: string;
  url: string;
  compact?: boolean;
  className?: string;
};

const SocialShareButtons = ({
  title,
  text,
  url,
  compact = false,
  className = "",
}: SocialShareButtonsProps) => {
  const [copied, setCopied] = useState(false);
  const targets = useMemo(
    () => buildSocialShareTargets({ title, text, url }),
    [title, text, url],
  );
  const disabled = !url;
  const rootClass = [
    "social-share",
    compact ? "social-share--compact" : "",
    className,
  ].filter(Boolean).join(" ");

  const handleNativeShare = async () => {
    if (disabled) return;
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleCopy = async () => {
    if (disabled) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className={rootClass} aria-label="Share options">
      <button
        type="button"
        className="social-share__button"
        onClick={() => void handleNativeShare()}
        disabled={disabled}
      >
        <Share2 aria-hidden size={16} />
        <span>Share</span>
      </button>
      <a className="social-share__button" href={targets.sms} aria-disabled={disabled}>
        <MessageCircle aria-hidden size={16} />
        <span>SMS</span>
      </a>
      <a
        className="social-share__button"
        href={targets.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={disabled}
      >
        <Send aria-hidden size={16} />
        <span>WhatsApp</span>
      </a>
      <a className="social-share__button" href={targets.email} aria-disabled={disabled}>
        <Mail aria-hidden size={16} />
        <span>Email</span>
      </a>
      <button
        type="button"
        className="social-share__button"
        onClick={() => void handleCopy()}
        disabled={disabled}
      >
        <Copy aria-hidden size={16} />
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
};

export default SocialShareButtons;
