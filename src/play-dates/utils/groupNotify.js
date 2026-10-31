// Texting groups about matches the host just created. One match uses
// POST /matches/:id/notify; a series uses POST /matches/notify-series, which
// sends each player one text listing every match.

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// Both endpoints answer with counts, under slightly different names.
export function describeGroupNotifyResult(result = {}) {
  const notified = Number(result?.players_notified ?? result?.sent ?? 0);
  if (!notified) {
    return { ok: true, text: "Everyone in those groups has already been told." };
  }
  const texted = Number(result?.sms_sent ?? 0);
  const noPhone = Number(result?.sms_skipped_missing_phone ?? 0);
  const failed = Number(result?.sms_failed ?? 0);
  const parts = [`Texted ${plural(texted, "player")}`];
  if (noPhone) parts.push(`${noPhone} without a mobile number`);
  if (failed) parts.push(`${plural(failed, "text")} failed`);
  return { ok: texted > 0, text: parts.join(" · ") };
}

export function describeGroupNotifyError(error) {
  const code = String(error?.data?.error || error?.message || "").toLowerCase();
  if (code.includes("no players") || code.includes("no_players")) {
    return "Everyone in those groups is already in these matches.";
  }
  if (code.includes("notification_limit")) {
    return "These matches have reached their limit of 30 texts.";
  }
  return "Couldn't send the texts. Try again.";
}

export const groupNotifyCaption = (matchCount) =>
  matchCount > 1
    ? `Each player gets one text listing these ${matchCount} matches.`
    : "Each player gets a text with a link to this match.";
