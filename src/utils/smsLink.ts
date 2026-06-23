// Shared helpers for building native `sms:` deep links. Used by both the
// all-players list (FindPlayersPage) and the player profile (PlayerProfilePage)
// "Send quick intro" flows so the two can't drift apart.

export const getSmsRecipient = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("@")) {
    return null;
  }

  const hasLeadingPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return null;
  }

  return hasLeadingPlus ? `+${digits}` : digits;
};

export const buildSmsUrl = (recipient: string, message: string) => {
  const encodedMessage = encodeURIComponent(message);
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const separator = isIos ? "&" : "?";
  return `sms:${recipient}${separator}body=${encodedMessage}`;
};
