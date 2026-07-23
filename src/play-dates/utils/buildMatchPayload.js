import { combineDateAndTimeToIso } from "./datetime.js";
import { buildSlotOptionPayloadFields } from "./matchSlotOptions.js";

// Pure payload builder for the multi-match creation flow.
//
// This intentionally reproduces — byte-for-byte — the payload that the legacy
// single-match flow assembles inline in MatchCreatorFlow.jsx `handlePublish`
// (the `payload` object around lines 815-849). It is used ONLY by the new
// MultiMatchCreatorFlow so the old file can stay 100% untouched; the
// "flag off = identical to today" guarantee is structural, not test-dependent.
//
// One card in -> one create-match payload out. The new flow calls this once per
// saved match card and POSTs each result through services/matches.createMatch.

// Spec uses the display label "Round-robin"; the backend's accepted vocabulary
// (utils/matchOptions.js) is "Round Robin". Map it here so the new flow can use
// whichever label internally. Already-correct values pass through unchanged.
const FORMAT_VALUE_MAP = {
  "Round-robin": "Round Robin",
  "Round-Robin": "Round Robin",
};

const normalizeFormat = (format) => FORMAT_VALUE_MAP[format] || format;

/**
 * @param {object} card  one match card from the new flow. Field names mirror the
 *   legacy `matchData` so the resulting payload matches the old flow exactly:
 *   { date, startTime, duration, location, latitude, longitude, totalPlayers,
 *     format, notes,
 *     // open only:
 *     skillLevel, skillLevelMin, skillLevelMax, gender, balls, verifiedOnly,
 *     listingVisibility }
 * @param {{ type: "open" | "private" }} opts
 * @returns {object} the create-match request body
 * @throws if date/time cannot be combined into a valid ISO start
 */
export function buildMatchPayload(card, { type } = {}) {
  const isoStart = combineDateAndTimeToIso(card.date, card.startTime);
  if (!isoStart) {
    throw new Error("Invalid start time");
  }

  const durationMinutes = Math.round(parseFloat(card.duration || "2") * 60);

  const payload = {
    status: "upcoming",
    match_type: type === "private" ? "private" : "open",
    start_date_time: isoStart,
    durationMinutes,
    duration_minutes: durationMinutes,
    location_text: card.location,
    latitude: card.latitude ?? undefined,
    longitude: card.longitude ?? undefined,
    player_limit: card.totalPlayers,
    match_format: normalizeFormat(card.format),
    notes: card.notes || undefined,
  };

  if (type === "open") {
    payload.skill_level_min = card.skillLevelMin || card.skillLevel;
    payload.skill_level_max =
      card.skillLevelMax || card.skillLevelMin || card.skillLevel;
    payload.gender = card.gender;
    payload.category = card.gender;
    payload.balls = card.balls;
    payload.verifiedOnly = Boolean(card.verifiedOnly);
    payload.verified_only = Boolean(card.verifiedOnly);

    const isHiddenMatch = card.listingVisibility === "link_only";
    payload.hidden = isHiddenMatch;
    payload.is_hidden = isHiddenMatch;
    payload.listing_visibility = isHiddenMatch ? "link_only" : "listed";
    if (isHiddenMatch) {
      payload.visibility = "hidden";
      payload.match_visibility = "hidden";
    }

    Object.assign(
      payload,
      buildSlotOptionPayloadFields({
        playerLimit: card.totalPlayers,
        preferredTime: isoStart,
        preferredLocation: {
          location_text: card.location,
          latitude: card.latitude,
          longitude: card.longitude,
        },
        timeOptions: card.timeOptions,
        locationOptions: card.locationOptions,
      }),
    );
  }

  return payload;
}

/**
 * Higher-level mapper: turn one multi-match-flow card into a create-match
 * payload. Resolves the card's level mode (my-level vs custom-range) and the
 * Open share choice (broadcast vs keep-on-profile) into the flat fields
 * buildMatchPayload expects, then delegates. This is the single place the new
 * flow converts a card to a payload, so N=1 equivalence with the legacy flow is
 * unit-testable.
 *
 * @param {object} card  a card from MultiMatchCreatorFlow
 *   ({ format, count, levelMode, rMin, rMax, date, startTime, duration,
 *      location, latitude, longitude })
 * @param {{ type: "open"|"private", playerRating: string|null,
 *           shareChoice: "broadcast"|"profile" }} ctx
 */
export function buildMatchPayloadFromCard(card, ctx = {}) {
  const { type, playerRating = null, shareChoice = "broadcast" } = ctx;
  const skill =
    card.levelMode === "range"
      ? { min: card.rMin, max: card.rMax }
      : { min: playerRating, max: playerRating };

  return buildMatchPayload(
    {
      date: card.date,
      startTime: card.startTime,
      duration: card.duration,
      location: card.location,
      latitude: card.latitude,
      longitude: card.longitude,
      totalPlayers: card.count,
      format: card.format,
      notes: "",
      skillLevel: skill.min,
      skillLevelMin: skill.min,
      skillLevelMax: skill.max,
      gender: "Any",
      balls: "Host provides",
      verifiedOnly: false,
      listingVisibility:
        type === "open" && shareChoice !== "broadcast" ? "link_only" : "listed",
    },
    { type },
  );
}

export { normalizeFormat, FORMAT_VALUE_MAP };
