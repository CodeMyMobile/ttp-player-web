// The expanded contact panel under a player row on the league Players tab.
//
// Every string it shows and every link it builds comes from contactSheet.ts, so
// the message preview the user reads is literally the body the deeplinks carry —
// they are the same value, not two renderings of the same idea.
//
// Platform behaviour: on a fine-pointer device `sms:` and `tel:` do nothing for
// most people, so Text and Call become copy-the-number actions instead. We never
// render a disabled button — a dead control tells the user they cannot do the
// thing, when in fact they can, just differently.

// Default React import alongside the hooks: Vite compiles this file with the
// automatic JSX runtime, but the node test runner (tsx, with no root tsconfig by
// design) uses the classic transform and needs React in scope to render it.
import React, { useCallback, useEffect, useRef, useState } from "react";

import Icon from "./Icon";
import {
  buildContactLinks,
  buildContactMessage,
  formatPhoneDisplay,
  toE164,
} from "./contactSheet";

interface PlayerContactSheetProps {
  playerName: string;
  phone: string;
  leagueName: string;
  senderName: string;
  senderAvailability?: string | null;
  /** True on touch devices, where sms:/tel: actually work. */
  pointerCoarse: boolean;
  onProposeMatch: () => void;
  id: string;
}

type CopyTarget = "number" | "text" | "call" | null;

const PlayerContactSheet = ({
  playerName,
  phone,
  leagueName,
  senderName,
  senderAvailability,
  pointerCoarse,
  onProposeMatch,
  id,
}: PlayerContactSheetProps) => {
  const [copied, setCopied] = useState<CopyTarget>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const e164 = toE164(phone);
  const body = buildContactMessage({
    recipientName: playerName,
    senderName,
    leagueName,
    availability: senderAvailability,
  });
  const links = buildContactLinks(phone, body);

  const copyNumber = useCallback(
    (target: Exclude<CopyTarget, null>) => {
      if (!e164) return;
      // Clipboard can reject (insecure context, denied permission). Show the
      // confirmation only when the write actually succeeded.
      void navigator.clipboard
        ?.writeText(e164)
        .then(() => {
          setCopied(target);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(null), 2000);
        })
        .catch(() => setCopied(null));
    },
    [e164],
  );

  if (!e164 || !links) return null;

  return (
    <div className="pcontact" id={id} role="region" aria-label={`Contact ${playerName}`}>
      <div className="pcontact-num">
        {/* Selectable text, not a button, so the number can be read aloud or
            highlighted by hand as well as copied. */}
        <span className="pcontact-digits">{formatPhoneDisplay(phone)}</span>
        <button
          type="button"
          className="pcontact-copy"
          onClick={() => copyNumber("number")}
          aria-label={`Copy ${playerName}'s number`}
        >
          {copied === "number" ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="pcontact-actions">
        {pointerCoarse ? (
          <>
            <a className="pcontact-btn" href={links.sms}>
              <Icon name="message-circle" /> Text
            </a>
            <a className="pcontact-btn" href={links.tel}>
              <Icon name="phone" /> Call
            </a>
          </>
        ) : (
          <>
            {/* Desktop: sms:/tel: are dead for most users, so offer the thing
                that does work rather than a disabled control. */}
            <button
              type="button"
              className="pcontact-btn"
              onClick={() => copyNumber("text")}
              title="Texting needs a phone — this copies the number instead"
            >
              <Icon name="message-circle" /> {copied === "text" ? "Copied" : "Copy to text"}
            </button>
            <button
              type="button"
              className="pcontact-btn"
              onClick={() => copyNumber("call")}
              title="Calling needs a phone — this copies the number instead"
            >
              <Icon name="phone" /> {copied === "call" ? "Copied" : "Copy to call"}
            </button>
          </>
        )}
        {/* wa.me opens WhatsApp Web on desktop, so this stays a real link everywhere. */}
        <a
          className="pcontact-btn"
          href={links.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="brand-whatsapp" /> WhatsApp
        </a>
      </div>

      <p className="pcontact-preview">{body}</p>

      <button type="button" className="pcontact-propose" onClick={onProposeMatch}>
        <Icon name="ball-tennis" />
        Propose a match in app
        <Icon name="arrow-right" className="pcontact-propose-go" />
      </button>
    </div>
  );
};

export default PlayerContactSheet;
