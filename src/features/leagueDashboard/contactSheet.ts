// Contact-sheet logic for the league Players tab: phone formatting, the outreach
// message, the three deeplinks, and the .vcf export.
//
// All of it is pure and lives here rather than in the component, because every
// piece is a correctness rule that is easy to get subtly wrong and impossible to
// eyeball in a rendered row — an E.164 number with punctuation left in, a body
// that double-encodes, a vCard missing its END line. The component decides what
// to show; this file decides what is true.

/** A player as far as the contact sheet is concerned. */
export interface ContactablePlayer {
  playerId: string;
  name: string;
  /** Raw phone as the API sends it — any format. */
  phone?: string | null;
  /** Per-league opt-in. Undefined means "backend has not told us", which is NOT consent. */
  shareContact?: boolean;
  /** Display rating used in the vCard name, e.g. "4.0". */
  levelLabel?: string | null;
}

/**
 * Consent is opt-IN. `undefined` means the backend has not shipped the field yet,
 * and absence of a "no" is not a "yes" — so it reads as withheld.
 */
export const canShowContact = (player: Pick<ContactablePlayer, "phone" | "shareContact">): boolean =>
  player.shareContact === true && Boolean(toE164(player.phone));

/**
 * Normalise to E.164. Assumes US/Canada when no country code is present, which
 * matches every other phone path in this app. Returns null when there is nothing
 * dialable — never a partial number, because a half-number in a `tel:` link
 * silently dials the wrong person.
 */
export const toE164 = (raw: unknown): string | null => {
  const digits = String(raw ?? "").replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) {
    const rest = digits.slice(1).replace(/\D/g, "");
    return rest.length >= 11 || rest.length === 10 ? `+${rest.length === 10 ? "1" : ""}${rest}` : null;
  }
  const bare = digits.replace(/\D/g, "");
  if (bare.length === 10) return `+1${bare}`;
  if (bare.length === 11 && bare.startsWith("1")) return `+${bare}`;
  return null;
};

/** `+13105550148` → `+1 (310) 555-0148`. Falls back to the E.164 form for non-US numbers. */
export const formatPhoneDisplay = (raw: unknown): string => {
  const e164 = toE164(raw);
  if (!e164) return "";
  const match = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return match ? `+1 (${match[1]}) ${match[2]}-${match[3]}` : e164;
};

/** wa.me wants digits only — no plus, no punctuation. */
export const toWhatsAppNumber = (raw: unknown): string => (toE164(raw) ?? "").replace(/\D/g, "");

/** First token of a full name, for the greeting. Empty string when there is nothing usable. */
export const firstName = (fullName: unknown): string =>
  String(fullName ?? "").trim().split(/\s+/)[0] ?? "";

/**
 * The outreach copy. Kept as one exported template so tuning the wording is a
 * one-line change and the message preview shown to the user cannot drift from
 * what the deeplinks actually carry — both call buildContactMessage.
 */
export const CONTACT_MESSAGE_TEMPLATE =
  "Hi {firstName} — {senderFirstName} here from the {leagueName}.\nWant to get our match in?";

/** Appended only when the sender has availability text; never emitted empty. */
export const AVAILABILITY_SENTENCE = "I'm usually free {availability}.";

export interface ContactMessageInput {
  recipientName: string;
  senderName: string;
  leagueName: string;
  /** Sender's own availability text, if their profile has any. */
  availability?: string | null;
}

export const buildContactMessage = ({
  recipientName,
  senderName,
  leagueName,
  availability,
}: ContactMessageInput): string => {
  const base = CONTACT_MESSAGE_TEMPLATE
    .replace("{firstName}", firstName(recipientName) || "there")
    .replace("{senderFirstName}", firstName(senderName) || "a fellow player")
    .replace("{leagueName}", String(leagueName ?? "").trim() || "league");

  const availabilityText = String(availability ?? "").trim();
  // No availability means no sentence at all — an empty trailing sentence reads
  // as a bug to the person receiving the text.
  if (!availabilityText) return base;
  return `${base} ${AVAILABILITY_SENTENCE.replace("{availability}", availabilityText)}`;
};

export interface ContactLinks {
  sms: string;
  tel: string;
  whatsapp: string;
}

/**
 * All three links from one body string, so the preview the user reads is exactly
 * what gets sent.
 *
 * `?body=` rather than `&body=`: the `&` form is a legacy iOS quirk that Android
 * does not understand, and modern iOS accepts `?`.
 */
export const buildContactLinks = (rawPhone: unknown, body: string): ContactLinks | null => {
  const e164 = toE164(rawPhone);
  if (!e164) return null;
  const encoded = encodeURIComponent(body);
  return {
    sms: `sms:${e164}?body=${encoded}`,
    tel: `tel:${e164}`,
    whatsapp: `https://wa.me/${toWhatsAppNumber(e164)}?text=${encoded}`,
  };
};

/* ---------- vCard export ---------- */

/**
 * vCard 3.0 escaping: backslash, comma and semicolon are structural, and a literal
 * newline would end the property. Getting this wrong produces a file that imports
 * with fields silently truncated rather than one that visibly fails.
 */
const escapeVCardValue = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** `FN` carries the league context so the entry still makes sense in a phone book months later. */
export const vCardDisplayName = (player: ContactablePlayer): string => {
  const name = String(player.name ?? "").trim() || "League player";
  const level = String(player.levelLabel ?? "").trim();
  return level ? `${name} (${level} flex)` : name;
};

export const buildVCard = (player: ContactablePlayer): string | null => {
  const e164 = toE164(player.phone);
  if (!e164) return null;
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVCardValue(vCardDisplayName(player))}`,
    `TEL;TYPE=CELL:${e164}`,
    "END:VCARD",
  ].join("\r\n");
};

/** One file, one VCARD block per opted-in player. Null when nobody is contactable. */
export const buildVCardFile = (players: ContactablePlayer[]): string | null => {
  const cards = players.filter(canShowContact).map(buildVCard).filter(Boolean) as string[];
  if (!cards.length) return null;
  // CRLF throughout and a trailing break — iOS is tolerant, some Android importers are not.
  return `${cards.join("\r\n")}\r\n`;
};

/** `Men's 4.0 Fall Flex 2026` → `mens-4-0-fall-flex-2026.vcf` */
export const vCardFileName = (leagueName: unknown): string => {
  const slug = String(leagueName ?? "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "league"}-contacts.vcf`;
};

/**
 * The header action is hidden below two opted-in players: a "Save all contacts"
 * that saves one contact is noise, and one that saves none is a broken promise.
 */
export const MIN_PLAYERS_FOR_BULK_SAVE = 2;

export const contactablePlayers = (players: ContactablePlayer[]): ContactablePlayer[] =>
  players.filter(canShowContact);

export const canSaveAllContacts = (players: ContactablePlayer[]): boolean =>
  contactablePlayers(players).length >= MIN_PLAYERS_FOR_BULK_SAVE;
