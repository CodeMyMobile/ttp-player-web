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
  /** TPR — null when the player is unrated. */
  rating?: number | null;
  /** NTRP display value, already formatted. */
  ntrp?: string | null;
  /** UTR display value, already formatted. */
  utr?: string | null;
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
 * The outreach copy. One exported constant so tuning the wording is a one-line
 * change, and so the body sent over SMS and the body sent over WhatsApp cannot
 * drift apart — both call buildContactMessage.
 */
export const CONTACT_MESSAGE_TEMPLATE =
  "Hi {firstName} — {senderFirstName} here from {leagueName}. Want to get our match in?";

export interface ContactMessageInput {
  recipientName: string;
  senderName: string;
  leagueName: string;
}

export const buildContactMessage = ({
  recipientName,
  senderName,
  leagueName,
}: ContactMessageInput): string =>
  CONTACT_MESSAGE_TEMPLATE
    .replace("{firstName}", firstName(recipientName) || "there")
    .replace("{senderFirstName}", firstName(senderName) || "a fellow player")
    .replace("{leagueName}", String(leagueName ?? "").trim() || "the league");

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

/**
 * Ratings the player actually holds, in the order the row shows them. Unrated
 * values are omitted rather than printed as blanks — a phone-book entry reading
 * "(TPR — · UTR unrated)" is worse than one with no parenthetical at all.
 */
export const ratingSuffix = (player: ContactablePlayer): string => {
  const parts = [
    player.rating === null || player.rating === undefined ? null : `TPR ${player.rating.toFixed(1)}`,
    player.ntrp ? `NTRP ${player.ntrp}` : null,
    player.utr ? `UTR ${player.utr}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
};

/** `FN` carries the ratings so the entry still means something in a phone book. */
export const vCardDisplayName = (player: ContactablePlayer): string => {
  const name = String(player.name ?? "").trim() || "League player";
  const suffix = ratingSuffix(player);
  return suffix ? `${name} (${suffix})` : name;
};

/**
 * Structured name. Given-name first token, family name the rest — kept separate
 * from FN so a phone sorts and searches the entry by the player's real name
 * rather than by the rating string appended to FN.
 */
const structuredName = (fullName: string): string => {
  const parts = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
  const given = parts[0] ?? "";
  const family = parts.slice(1).join(" ");
  return `${escapeVCardValue(family)};${escapeVCardValue(given)};;;`;
};

export const buildVCard = (player: ContactablePlayer, leagueName?: string): string | null => {
  const e164 = toE164(player.phone);
  if (!e164) return null;
  const note = String(leagueName ?? "").trim();
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVCardValue(vCardDisplayName(player))}`,
    `N:${structuredName(String(player.name ?? ""))}`,
    `TEL;TYPE=CELL:${e164}`,
    ...(note ? [`NOTE:${escapeVCardValue(note)}`] : []),
    "END:VCARD",
  ].join("\r\n");
};

/** One file, one VCARD block per opted-in player. Null when nobody is contactable. */
export const buildVCardFile = (players: ContactablePlayer[], leagueName?: string): string | null => {
  const cards = players
    .filter(canShowContact)
    .map((player) => buildVCard(player, leagueName))
    .filter(Boolean) as string[];
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
  return `${slug || "league"}.vcf`;
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

/** How many players share a number — drives the footnote and the export gate. */
export const sharedContactCount = (players: ContactablePlayer[]): number =>
  contactablePlayers(players).length;
