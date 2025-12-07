import { request, type RequestQuery } from "./http";

export type TruthyLike = boolean | string | number;

export type MatchRelationship = "host" | "participant" | "viewer";

export interface MatchLevel {
  summary: string;
  detail?: string;
}

export interface NormalizedMatchParticipant {
  id?: string;
  name?: string;
  hosting?: boolean;
  identityIds?: string[];
  isCurrentUser?: boolean;
  avatarUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface NormalizedMatch {
  id: string;
  access: "Open" | "Private";
  visibility?: string;
  visibilityLabel?: string;
  relationship: MatchRelationship;
  type?: string;
  startDisplay: string;
  startDateTimeIso?: string;
  location: string;
  locationDetail?: string;
  distance: string;
  playersJoined: number;
  totalSpots: number;
  playersNeeded?: number;
  level?: MatchLevel;
  format?: string;
  hostName?: string;
  hostIdentityIds?: string[];
  participants?: NormalizedMatchParticipant[];
  raw?: unknown;
}

export interface MatchesPagination {
  total?: number;
  perPage?: number;
  page?: number;
  raw?: unknown;
}

export interface MatchesResponse {
  matches: unknown[];
  pagination?: MatchesPagination;
  raw?: unknown;
}

export interface ListMatchesParams {
  search?: string;
  page?: number;
  perPage?: number;
  filter?: string;
  status?: string;
  visibility?: string;
  includeHidden?: TruthyLike;
  include_hidden?: TruthyLike;
  hidden?: TruthyLike;
  hiddenOnly?: TruthyLike;
  latitude?: number;
  longitude?: number;
  distance?: number;
  radius?: number;
  token?: string | null;
  signal?: AbortSignal;
}

export interface CreateMatchParams {
  privacy: "open" | "private";
  startDateTime?: string | Date;
  locationText: string;
  latitude?: number;
  longitude?: number;
  rosterSize?: number | null;
  skillLevel?: string | number | null;
  matchFormat?: string | null;
  notes?: string | null;
  linkOnly?: boolean;
  token?: string | null;
  signal?: AbortSignal;
}

const isTruthyFlag = (value: TruthyLike | null | undefined) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
};

const buildMatchesQuery = ({
  search,
  page,
  perPage,
  filter,
  status,
  visibility,
  includeHidden,
  include_hidden,
  hidden,
  hiddenOnly,
  latitude,
  longitude,
  distance,
  radius,
}: ListMatchesParams): RequestQuery => {
  const query: RequestQuery = {};

  if (page) query.page = page;
  if (perPage) query.perPage = perPage;
  if (search?.trim()) query.search = search.trim();
  if (filter?.trim()) query.filter = filter.trim();
  if (status) query.status = status;
  if (visibility) query.visibility = visibility;
  if (hidden !== undefined) query.hidden = hidden;
  if (hiddenOnly !== undefined) query.hiddenOnly = hiddenOnly;

  const includeHiddenFlag = includeHidden ?? include_hidden;
  const explicitlyFalse = include_hidden === false || include_hidden === "false" || include_hidden === 0;

  if (isTruthyFlag(includeHiddenFlag)) {
    query.include_hidden = true;
  } else if (explicitlyFalse) {
    query.include_hidden = false;
  }

  if (typeof latitude === "number" && typeof longitude === "number") {
    query.latitude = latitude;
    query.longitude = longitude;
    if (typeof distance === "number") {
      query.distance = distance;
    } else if (typeof radius === "number") {
      query.radius = radius;
    }
  }

  return query;
};

const toIsoString = (value?: string | Date | null) => {
  if (!value) return undefined;
  const date = typeof value === "string" ? new Date(value) : value;
  const timestamp = date?.getTime?.();
  if (!timestamp || Number.isNaN(timestamp)) return undefined;
  return new Date(timestamp).toISOString();
};

const isMatchStatusEnumError = (error: unknown) => {
  const message = (error as Error | undefined)?.message?.toLowerCase?.() ?? "";
  if (message.includes("match_status_enum")) return true;

  const data = (error as { data?: unknown } | undefined)?.data;
  if (!data || typeof data !== "object") return false;

  const serialized = JSON.stringify(data).toLowerCase();
  return serialized.includes("match_status_enum");
};

const CREATED_MATCH_STORAGE_KEY = "ttp:last-created-match";

const deriveMatchId = (source: unknown): string | undefined => {
  if (!source || typeof source !== "object") return undefined;
  const record = source as Record<string, unknown>;
  const idCandidate =
    record.id ?? record.match_id ?? record.matchId ?? record.slug ?? (record.match as Record<string, unknown> | undefined)?.id;

  if (idCandidate === undefined || idCandidate === null) return undefined;
  return String(idCandidate);
};

const deriveShareLink = (source: unknown): string | undefined => {
  if (!source || typeof source !== "object") return undefined;
  const record = source as Record<string, unknown>;
  const shareCandidate = record.share_link ?? record.shareLink ?? record.share_url ?? record.url;
  if (typeof shareCandidate !== "string") return undefined;
  return shareCandidate;
};

const persistCreatedMatch = (response: unknown) => {
  const match = extractMatchDetail(response) as Record<string, unknown> | undefined;
  const matchId = deriveMatchId(match ?? response);
  const shareLink = deriveShareLink(match ?? response);

  if (typeof window !== "undefined" && window.localStorage && (matchId || shareLink)) {
    try {
      window.localStorage.setItem(CREATED_MATCH_STORAGE_KEY, JSON.stringify({ id: matchId, shareLink }));
    } catch {
      // Ignore storage failures
    }
  }

  return { matchId, shareLink, match, raw: response };
};

export const createMatch = async ({
  privacy,
  startDateTime,
  locationText,
  latitude,
  longitude,
  rosterSize,
  skillLevel,
  matchFormat,
  notes,
  linkOnly,
  token,
  signal,
}: CreateMatchParams) => {
  const status = "upcoming";
  const matchType = privacy === "private" ? "private" : "open";

  const payload: Record<string, unknown> = {
    status,
    match_type: matchType,
    location_text: locationText,
    location: locationText,
    listing_visibility: "listed",
  };

  const startIso = toIsoString(startDateTime);
  if (startIso) {
    payload.start_date_time = startIso;
    payload.dateTime = startIso;
  }

  if (typeof latitude === "number") payload.latitude = latitude;
  if (typeof longitude === "number") payload.longitude = longitude;

  if (typeof rosterSize === "number") {
    payload.player_limit = rosterSize;
    payload.playerCount = rosterSize;
  }

  if (matchType === "open" && skillLevel !== undefined && skillLevel !== null && `${skillLevel}`.trim() !== "") {
    payload.skill_level_min = skillLevel;
    payload.skillLevel = skillLevel;
  }

  if (matchFormat) {
    payload.match_format = matchFormat;
    payload.format = matchFormat;
  }

  if (notes) {
    payload.notes = notes;
  }

  if (matchType === "open" && linkOnly) {
    payload.hidden = true;
    payload.is_hidden = true;
    payload.listing_visibility = "link_only";
    payload.visibility = "hidden";
    payload.match_visibility = "hidden";
  }

  const executeCreate = async (override?: Record<string, unknown>) =>
    request<unknown>("/matches", {
      method: "POST",
      token: token ?? undefined,
      signal,
      body: {
        ...payload,
        ...override,
      },
    });

  try {
    const response = await executeCreate();
    return persistCreatedMatch(response);
  } catch (error) {
    if (!isMatchStatusEnumError(error)) throw error;

    const response = await executeCreate({
      status: matchType,
      match_type: status,
    });
    return persistCreatedMatch(response);
  }
};

const firstNumber = (values: Array<unknown>): number | undefined => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) continue;
      const parsed = Number.parseFloat(trimmed);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const firstString = (values: Array<unknown>): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
};

const formatDistanceLabel = (value: unknown): string => {
  if (typeof value === "string" && value.trim()) return value.trim();
  const numeric = firstNumber([value]);
  if (numeric === undefined) return "";
  const rounded = numeric >= 10 ? Math.round(numeric) : Number(numeric.toFixed(1));
  const suffix = rounded === 1 ? "mile" : "miles";
  return `${rounded} ${suffix} away`;
};

const formatDateLabel = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const deriveStartLabel = (record: Record<string, unknown>): string => {
  const label = firstString([
    record.startDisplay,
    record.start_display,
    record.start_time_label,
    record.starts_at_label,
    record.start_time,
    record.start,
    record.time_label,
    record.date_label,
    record.schedule,
  ]);
  if (label) return label;

  const isoCandidate = firstString([
    record.startDateTime,
    record.start_date_time,
    record.start_at,
    record.starts_at,
    record.datetime,
    record.start_time_iso,
  ]);

  return formatDateLabel(isoCandidate) ?? "Schedule to be announced";
};

const deriveAccess = (record: Record<string, unknown>): "Open" | "Private" => {
  const accessValue = firstString([
    record.access,
    record.visibility,
    record.match_type,
    record.matchType,
    record.type,
    record.access_type,
    record.privacy,
  ]);

  if (!accessValue) return "Open";

  const normalized = accessValue.toLowerCase();
  if (normalized.includes("private") || normalized.includes("invite")) return "Private";
  if (normalized.includes("open") || normalized.includes("public") || normalized.includes("link")) return "Open";

  return "Open";
};

const deriveVisibility = (record: Record<string, unknown>) => {
  const visibility = firstString([
    record.visibility,
    record.match_visibility,
    record.access,
    record.access_type,
    record.match_type,
  ]);

  if (!visibility) return undefined;

  const normalized = visibility.toLowerCase();
  if (normalized.includes("link")) return "link_only";
  if (normalized.includes("unlisted")) return "unlisted";
  if (normalized.includes("hidden")) return "hidden";
  if (normalized.includes("private") || normalized.includes("invite")) return "private";
  return "open";
};

export const isOpenMatch = (record: unknown): boolean => {
  const visibility = deriveVisibility((record ?? {}) as Record<string, unknown>);
  const access = deriveAccess((record ?? {}) as Record<string, unknown>);

  return visibility !== "private" && access !== "Private";
};

const formatVisibilityLabel = (value?: string) => {
  if (!value) return undefined;
  switch (value) {
    case "link_only":
    case "link-only":
    case "link only":
      return "Link-only";
    case "unlisted":
      return "Unlisted";
    case "hidden":
      return "Hidden";
    case "private":
      return "Invite only";
    default:
      return "Open";
  }
};

export const identityValues = (source: unknown, seen = new Set<unknown>()): string[] => {
  if (source === null || source === undefined) return [];

  if (typeof source === "string") {
    const trimmed = source.trim();
    return trimmed ? [trimmed] : [];
  }

  if (typeof source === "number") {
    if (!Number.isFinite(source)) return [];
    return [String(source)];
  }

  if (typeof source !== "object") return [];
  if (seen.has(source)) return [];

  seen.add(source);

  if (Array.isArray(source)) {
    const values = source.flatMap((value) => identityValues(value, seen));
    return Array.from(new Set(values));
  }

  const record = source as Record<string, unknown>;
  const identifiers: Array<unknown> = [
    record.id,
    record._id,
    record.user_id,
    record.userId,
    record.uuid,
    record.uid,
    record.identity,
    record.identity_id,
    record.identityId,
    record.profile_id,
    record.profileId,
    record.player_id,
    record.playerId,
    record.member_id,
    record.memberId,
    record.member_identity,
    record.memberIdentity,
    record.created_by,
    record.createdBy,
    record.email,
    record.email_address,
    record.emailAddress,
    record.username,
    record.user_name,
    record.handle,
    record.slug,
  ];

  const values = identifiers
    .map((value) => {
      const text = firstString([value]);
      if (text) return text;
      const numeric = firstNumber([value]);
      return numeric !== undefined ? String(numeric) : undefined;
    })
    .filter(Boolean) as string[];

  const nestedSources: Array<unknown> = [
    record.user,
    record.profile,
    record.member,
    record.player,
    record.identity,
    record.owner,
    record.account,
    record.member_profile,
    record.memberProfile,
    record.account_profile,
    record.accountProfile,
    record.owner_profile,
    record.ownerProfile,
    record.host,
    record.host_profile,
    record.hostProfile,
    record.host_identity,
    record.hostIdentity,
    record.organizer,
    record.organizer_profile,
    record.organizerProfile,
    record.organizer_identity,
    record.organizerIdentity,
    record.created_by,
    record.createdBy,
    record.created_by_profile,
    record.createdByProfile,
    record.created_by_identity,
    record.createdByIdentity,
    record.creator,
    record.creator_profile,
    record.creatorProfile,
    record.creator_identity,
    record.creatorIdentity,
    record.identities,
    record.accounts,
    record.profiles,
    record.hosts,
    record.data,
    record.details,
  ];

  const nestedValues = nestedSources.flatMap((value) => identityValues(value, seen));

  return Array.from(new Set([...values, ...nestedValues].map((value) => value.toString().trim())));
};

const deriveHostIdentities = (record: Record<string, unknown>) =>
  Array.from(
    new Set(
      [
        ...identityValues(record.host),
        ...identityValues(record.host_profile),
        ...identityValues(record.hostProfile),
        ...identityValues(record.host_identity),
        ...identityValues(record.hostIdentity),
        ...identityValues(record.organizer),
        ...identityValues(record.organizer_profile),
        ...identityValues(record.organizerProfile),
        ...identityValues(record.organizer_identity),
        ...identityValues(record.organizerIdentity),
        ...identityValues(record.owner),
        ...identityValues(record.owner_profile),
        ...identityValues(record.ownerProfile),
        ...identityValues(record.owner_identity),
        ...identityValues(record.ownerIdentity),
        ...identityValues(record.creator),
        ...identityValues(record.creator_profile),
        ...identityValues(record.creatorProfile),
        ...identityValues(record.creator_identity),
        ...identityValues(record.creatorIdentity),
        ...identityValues(record.created_by_profile),
        ...identityValues(record.createdByProfile),
        ...identityValues(record.created_by_identity),
        ...identityValues(record.createdByIdentity),
        ...identityValues(record.hosts),
        ...identityValues({
          id: firstString([
            record.host_id,
            record.hostId,
            record.host_identity_id,
            record.organizer_id,
            record.organizerId,
            record.organizer_identity_id,
            record.owner_id,
            record.ownerId,
            record.owner_identity_id,
            record.created_by_identity_id,
            record.creator_identity_id,
            record.created_by,
            record.createdBy,
          ]),
        }),
      ].filter(Boolean),
    ),
  );

const deriveRelationship = (
  record: Record<string, unknown>,
  options: { currentUser?: unknown } = {},
): MatchRelationship => {
  const relationship = firstString([
    record.relationship,
    record.role,
    record.user_relationship,
  ]);
  if (relationship === "host" || relationship === "participant") return relationship;

  const userIdentities = identityValues(options.currentUser);

  if (typeof record.type === "string" && record.type.toLowerCase() === "hosted") return "host";

  const participantHosting =
    Array.isArray(record.participants) &&
    record.participants.some((participant) => {
      if (!participant || typeof participant !== "object") return false;
      const participantRecord = participant as Record<string, unknown>;
      if (!participantRecord.hosting && !participantRecord.is_host && !participantRecord.isHost)
        return false;
      const participantIds = identityValues(participantRecord);
      const isCurrentUserParticipant =
        participantRecord.is_current_user === true || participantRecord.isCurrentUser === true;
      return (
        isCurrentUserParticipant ||
        (participantIds.length > 0 && userIdentities.some((id) => participantIds.includes(id)))
      );
    });

  if (participantHosting) return "host";

  const hostIdentityValues = deriveHostIdentities(record);

  const isCurrentUserHost =
    hostIdentityValues.length > 0 &&
    userIdentities.some((id) => hostIdentityValues.includes(id));

  if (record.is_host || record.isHost || isCurrentUserHost) return "host";
  if (record.is_participant || record.isParticipant) return "participant";

  return "viewer";
};

const extractLocationFromObject = (value: unknown) => {
  if (!value || typeof value !== "object") return {} as Record<string, string | undefined>;
  const source = value as Record<string, unknown>;
  const address =
    source.address && typeof source.address === "object"
      ? (source.address as Record<string, unknown>)
      : undefined;
  const nested =
    source.data && typeof source.data === "object"
      ? (source.data as Record<string, unknown>)
      : undefined;
  const nestedAddress =
    nested?.address && typeof nested.address === "object"
      ? (nested.address as Record<string, unknown>)
      : undefined;

  const primary = firstString([
    source.location_text,
    source.locationText,
    source.name,
    source.title,
    source.label,
    source.location,
    source.location_name,
    source.locationName,
    source.venue,
    source.venue_name,
    source.venueName,
    source.club,
    source.club_name,
    source.court,
    source.court_name,
    source.place,
    source.location_text,
    source.locationText,
    nested?.name,
    nested?.title,
    nested?.label,
    nested?.location,
    nested?.location_name,
    nested?.locationName,
    nested?.venue,
    nested?.venue_name,
    nested?.venueName,
    nested?.club,
    nested?.club_name,
    nested?.court,
    nested?.court_name,
    nested?.place,
    nested?.location_text,
    nested?.locationText,
    address?.name,
    address?.title,
    address?.label,
    address?.location,
    address?.location_name,
    address?.location_text,
    address?.locationText,
    nestedAddress?.name,
    nestedAddress?.title,
    nestedAddress?.label,
    nestedAddress?.location,
    nestedAddress?.location_name,
    nestedAddress?.location_text,
    nestedAddress?.locationText,
  ]);
  const city = firstString([
    source.city,
    source.location_city,
    source.town,
    nested?.city,
    nested?.location_city,
    nested?.town,
    address?.city,
    address?.location_city,
    address?.town,
    nestedAddress?.city,
    nestedAddress?.location_city,
    nestedAddress?.town,
  ]);
  const state = firstString([
    source.state,
    source.region,
    source.state_code,
    nested?.state,
    nested?.region,
    nested?.state_code,
    address?.state,
    address?.region,
    address?.state_code,
    nestedAddress?.state,
    nestedAddress?.region,
    nestedAddress?.state_code,
  ]);
  const detail = firstString([
    source.location_detail,
    source.location_detail_label,
    source.address,
    source.address_line_1,
    source.address_line1,
    source.address_line,
    source.street,
    source.street_1,
    source.street_address,
    source.detail,
    source.formatted_address,
    source.display_address,
    nested?.location_detail,
    nested?.location_detail_label,
    nested?.address,
    nested?.address_line_1,
    nested?.address_line1,
    nested?.address_line,
    nested?.street,
    nested?.street_1,
    nested?.street_address,
    nested?.detail,
    nested?.formatted_address,
    nested?.display_address,
    address?.address,
    address?.address_line_1,
    address?.address_line1,
    address?.address_line,
    address?.street,
    address?.street_1,
    address?.street_address,
    address?.formatted,
    address?.formatted_address,
    nestedAddress?.address,
    nestedAddress?.address_line_1,
    nestedAddress?.address_line1,
    nestedAddress?.address_line,
    nestedAddress?.street,
    nestedAddress?.street_1,
    nestedAddress?.street_address,
    nestedAddress?.formatted,
    nestedAddress?.formatted_address,
  ]);

  return { primary, city, state, detail } as const;
};

const deriveLocationLabel = (record: Record<string, unknown>): string => {
  const nestedLocation = extractLocationFromObject(record.location);
  const fallbackNested = firstString([
    extractLocationFromObject(record.location_detail).primary,
    extractLocationFromObject(record.location_details).primary,
    extractLocationFromObject(record.locationData).primary,
    extractLocationFromObject(record.location_data).primary,
    extractLocationFromObject(record.location_info).primary,
    extractLocationFromObject(record.locationInfo).primary,
    extractLocationFromObject(record.venue_details).primary,
    extractLocationFromObject(record.venue_detail).primary,
    extractLocationFromObject(record.address).primary,
  ]);

  const primary =
    firstString([
      record.location_text,
      record.locationText,
      record.location,
      record.location_name,
      record.locationName,
      record.venue,
      record.club,
      record.club_name,
      record.court,
      record.court_name,
      nestedLocation.primary,
      fallbackNested,
      deriveLocationDetail(record),
    ]) ?? undefined;
  const city = firstString([
    record.city,
    record.location_city,
    record.town,
    nestedLocation.city,
    extractLocationFromObject(record.location_detail).city,
    extractLocationFromObject(record.location_details).city,
    extractLocationFromObject(record.locationData).city,
    extractLocationFromObject(record.location_data).city,
    extractLocationFromObject(record.location_info).city,
    extractLocationFromObject(record.locationInfo).city,
    extractLocationFromObject(record.venue_details).city,
    extractLocationFromObject(record.venue_detail).city,
    extractLocationFromObject(record.address).city,
  ]);
  const state = firstString([
    record.state,
    record.region,
    nestedLocation.state,
    extractLocationFromObject(record.location_detail).state,
    extractLocationFromObject(record.location_details).state,
    extractLocationFromObject(record.locationData).state,
    extractLocationFromObject(record.location_data).state,
    extractLocationFromObject(record.location_info).state,
    extractLocationFromObject(record.locationInfo).state,
    extractLocationFromObject(record.venue_details).state,
    extractLocationFromObject(record.venue_detail).state,
    extractLocationFromObject(record.address).state,
  ]);
  const secondaryParts = [city, state].filter(Boolean);
  if (primary) {
    return secondaryParts.length > 0 ? `${primary} · ${secondaryParts.join(", ")}` : primary;
  }
  if (secondaryParts.length > 0) return secondaryParts.join(", ");
  return "Location to be announced";
};

const deriveLocationDetail = (record: Record<string, unknown>): string | undefined =>
  firstString([
    record.location_detail,
    record.location_detail_label,
    record.address,
    record.address_line_1,
    record.address_line1,
    record.address_line,
    record.street,
    record.street_1,
    record.street_address,
    extractLocationFromObject(record.location).detail,
    extractLocationFromObject(record.location_detail).detail,
    extractLocationFromObject(record.location_details).detail,
    extractLocationFromObject(record.locationData).detail,
    extractLocationFromObject(record.location_data).detail,
    extractLocationFromObject(record.location_info).detail,
    extractLocationFromObject(record.locationInfo).detail,
    extractLocationFromObject(record.venue_details).detail,
    extractLocationFromObject(record.venue_detail).detail,
    extractLocationFromObject(record.address).detail,
  ]);

const derivePlayers = (record: Record<string, unknown>) => {
  const capacityObject = [record.capacity, record.roster_capacity, record.player_capacity].find(
    (value): value is Record<string, unknown> =>
      Boolean(value) && typeof value === "object" && !Array.isArray(value),
  );

  const participantsCount = Array.isArray(record.participants)
    ? record.participants.length
    : undefined;
  const inviteesCount = Array.isArray(record.invitees) ? record.invitees.length : undefined;

  const playersJoined =
    firstNumber([
      record.playersJoined,
      record.players_joined,
      record.joined_players,
      record.players_count,
      record.participants,
      record.participants_count,
      record.confirmed_players,
      record.current_players,
      record.occupied,
      record.roster_count,
      capacityObject?.confirmed,
      capacityObject?.current,
      capacityObject?.occupied,
      capacityObject?.filled,
    ]) ?? participantsCount ?? inviteesCount ?? 0;

  const totalSpots = firstNumber([
    record.totalSpots,
    record.total_players,
    record.total_spots,
    record.capacity,
    record.player_capacity,
    record.max_players,
    record.player_limit,
    record.playerLimit,
    record.match_player_limit,
    record.player_cap,
    capacityObject?.limit,
    capacityObject?.max,
    capacityObject?.capacity,
  ]);

  let playersNeeded = firstNumber([
    record.playersNeeded,
    record.players_needed,
    record.players_remaining,
    record.spots_left,
    record.available_spots,
    record.rosterSpotsRemaining,
    record.spotsAvailable,
    record.open,
    capacityObject?.open,
    capacityObject?.remaining,
    capacityObject?.available,
  ]);

  const computedTotal =
    totalSpots ??
    (playersNeeded !== undefined || playersJoined > 0
      ? playersJoined + (playersNeeded ?? 0)
      : undefined);

  if (playersNeeded === undefined && computedTotal !== undefined) {
    playersNeeded = Math.max(computedTotal - playersJoined, 0);
  }

  return {
    playersJoined,
    totalSpots: computedTotal ?? playersJoined,
    playersNeeded,
  };
};

const deriveLevel = (record: Record<string, unknown>): MatchLevel | undefined => {
  const baseLevel = firstNumber([
    record.skill_level_min,
    record.skillLevelMin,
    record.level_min,
    record.levelMin,
    record.skill_level,
    record.skillLevel,
    record.level,
    record.level_summary,
  ]);
  const max = firstNumber([
    record.skill_level_max,
    record.skillLevelMax,
    record.level_max,
    record.levelMax,
  ]);

  const formatValue = (value: number) => value.toFixed(1).replace(/\.0$/, ".0");
  const endLevel =
    baseLevel !== undefined
      ? Number((baseLevel + 0.5).toFixed(1))
      : max !== undefined
        ? Number((max + 0.5).toFixed(1))
        : undefined;
  const rangeLabel = baseLevel !== undefined
    ? `${formatValue(baseLevel)}-${formatValue(endLevel ?? baseLevel)}`
    : max !== undefined
      ? `${formatValue(max)}-${formatValue(endLevel ?? max)}`
      : undefined;

  const fallbackSummary = firstString([
    record.level,
    record.level_summary,
    record.skill_level,
    record.skillLevel,
    record.skill,
  ]);
  const summary = rangeLabel ?? fallbackSummary;
  if (!summary) return undefined;

  const detail = firstString([
    record.level_detail,
    record.skill_level_label,
    record.skill_level_description,
  ]) ?? (rangeLabel && fallbackSummary && rangeLabel !== fallbackSummary ? fallbackSummary : undefined);

  return {
    summary,
    detail,
  };
};

const deriveMatchFormat = (record: Record<string, unknown>): string | undefined =>
  firstString([
    record.match_format,
    record.matchFormat,
    record.match_type,
    record.matchType,
    record.format,
    record.play_format,
    record.playFormat,
  ]);

const deriveMatchType = (record: Record<string, unknown>): string | undefined =>
  firstString([record.type, record.match_type, record.matchType, record.match_category]);

const deriveStartIso = (record: Record<string, unknown>): string | undefined =>
  firstString([
    record.startDateTime,
    record.start_date_time,
    record.start_at,
    record.starts_at,
    record.datetime,
    record.start_time_iso,
    record.start_time,
    record.start,
  ]);

const extractMatchesArray = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const body = payload as Record<string, unknown>;
  const direct = firstArray([body.matches, body.data, body.items, body.results]);
  if (direct) return direct;

  if (body.data && typeof body.data === "object") {
    const nested = body.data as Record<string, unknown>;
    const nestedArray = firstArray([nested.matches, nested.data, nested.items]);
    if (nestedArray) return nestedArray;
  }

  return [];
};

const firstArray = (values: Array<unknown>): unknown[] | undefined => {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return undefined;
};

const deriveParticipants = (
  record: Record<string, unknown>,
  options: { currentUser?: unknown } = {},
) => {
  const participantsArray = firstArray([
    record.participants,
    record.roster,
    record.players,
    record.invitees,
  ]);

  if (!participantsArray) return undefined;

  const userIdentities = identityValues(options.currentUser);

  const participants = participantsArray
    .map((participant) => {
      if (!participant || typeof participant !== "object") return null;
      const participantRecord = participant as Record<string, unknown>;
      const profile =
        participantRecord.profile && typeof participantRecord.profile === "object"
          ? (participantRecord.profile as Record<string, unknown>)
          : undefined;
      const identityIds = identityValues(participantRecord);
      const isFlaggedCurrentUser =
        participantRecord.is_current_user === true || participantRecord.isCurrentUser === true;
      const id = firstString([
        participantRecord.id,
        participantRecord.uuid,
        participantRecord.identity_id,
        participantRecord.profile_id,
        participantRecord.user_id,
        participantRecord.player_id,
      ]);
      const name = firstString([
        participantRecord.name,
        participantRecord.full_name,
        participantRecord.fullName,
        participantRecord.display_name,
        participantRecord.displayName,
        participantRecord.player_name,
        profile?.name,
        profile?.full_name,
        profile?.display_name,
      ]);
      const hosting = Boolean(
        participantRecord.hosting ||
        participantRecord.is_host ||
          participantRecord.isHost ||
          participantRecord.host === true,
      );
      const isCurrentUser =
        isFlaggedCurrentUser ||
        (identityIds.length > 0 && userIdentities.some((value) => identityIds.includes(value)));

      const avatarUrl = firstString([
        participantRecord.avatar_url,
        participantRecord.avatarUrl,
        participantRecord.profile_image,
        participantRecord.profileImage,
        participantRecord.image_url,
        participantRecord.imageUrl,
        participantRecord.photo,
      ]);

      const contactEmail = firstString([
        participantRecord.email,
        participantRecord.contact_email,
        participantRecord.contactEmail,
      ]);

      const contact =
        participantRecord.contact && typeof participantRecord.contact === "object"
          ? (participantRecord.contact as Record<string, unknown>)
          : undefined;

      const contactPhone = firstString([
        participantRecord.phone,
        participantRecord.phone_number,
        participantRecord.phoneNumber,
        participantRecord.contact_phone,
        participantRecord.contactPhone,
        profile?.phone,
        profile?.phone_number,
        profile?.phoneNumber,
        profile?.contact_phone,
        profile?.contactPhone,
        contact?.phone,
        contact?.phone_number,
        contact?.phoneNumber,
        contact?.contact_phone,
        contact?.contactPhone,
      ]);

      return {
        id: id ?? (identityIds.length ? identityIds[0] : undefined),
        name,
        hosting,
        identityIds: identityIds.length ? identityIds : undefined,
        isCurrentUser,
        avatarUrl: avatarUrl || undefined,
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
      } satisfies NormalizedMatchParticipant;
    })
    .filter(Boolean) as NormalizedMatchParticipant[];

  return participants.length > 0 ? participants : undefined;
};

const extractPagination = (payload: unknown): MatchesPagination | undefined => {
  if (!payload || typeof payload !== "object") return undefined;
  const body = payload as Record<string, unknown>;
  const meta = (body.meta as Record<string, unknown> | undefined) ??
    (body.data && typeof body.data === "object" ? ((body.data as Record<string, unknown>).meta as Record<string, unknown> | undefined) : undefined);
  const pagination = (meta?.pagination as Record<string, unknown> | undefined) ??
    (body.pagination as Record<string, unknown> | undefined) ??
    meta;

  const total = firstNumber([
    pagination?.total,
    pagination?.total_count,
    body.total,
    body.count,
    (body.data as Record<string, unknown> | undefined)?.total,
  ]);
  const perPage = firstNumber([
    pagination?.per_page,
    pagination?.perPage,
    body.per_page,
    body.perPage,
  ]);
  const page = firstNumber([
    pagination?.current_page,
    pagination?.page,
    body.page,
    body.current_page,
  ]);

  if (total === undefined && perPage === undefined && page === undefined) {
    if (pagination) return { raw: pagination };
    return undefined;
  }

  return {
    total,
    perPage,
    page,
    raw: pagination,
  };
};

export const normalizeMatchRecord = (
  record: unknown,
  options: { currentUser?: unknown } = {},
): NormalizedMatch => {
  const safeRecord = (record ?? {}) as Record<string, unknown>;
  const id =
    firstString([
      safeRecord.id,
      safeRecord.uuid,
      safeRecord.match_id,
      safeRecord.slug,
      safeRecord.code,
    ]) ??
    (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

  const access = deriveAccess(safeRecord);
  const visibility = deriveVisibility(safeRecord);
  const relationship = deriveRelationship(safeRecord, { currentUser: options.currentUser });
  const type = deriveMatchType(safeRecord);
  const startDisplay = deriveStartLabel(safeRecord);
  const startDateTimeIso = deriveStartIso(safeRecord);
  const location = deriveLocationLabel(safeRecord);
  const locationDetail = deriveLocationDetail(safeRecord);
  const distance = formatDistanceLabel(
    firstString([
      safeRecord.distance_label,
      safeRecord.distance_miles,
      safeRecord.distanceMiles,
      safeRecord.distance,
      safeRecord.proximity,
    ]) ?? firstNumber([safeRecord.distance, safeRecord.distance_miles, safeRecord.distanceMiles, safeRecord.proximity]),
  );
  const { playersJoined, totalSpots, playersNeeded } = derivePlayers(safeRecord);
  const level = deriveLevel(safeRecord);
  const format = deriveMatchFormat(safeRecord);
  const hostIdentityIds = deriveHostIdentities(safeRecord);
  const participants = deriveParticipants(safeRecord, { currentUser: options.currentUser });
  const hostProfile = [safeRecord.host_profile, safeRecord.hostProfile, safeRecord.organizer_profile]
    .find((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object");
  const hostName = firstString([
    safeRecord.host_name,
    safeRecord.host,
    safeRecord.organizer,
    hostProfile?.name,
    hostProfile?.full_name,
    hostProfile?.display_name,
  ]);

  return {
    id,
    access,
    visibility,
    visibilityLabel: formatVisibilityLabel(visibility),
    relationship,
    type,
    startDisplay,
    startDateTimeIso,
    location,
    locationDetail,
    distance,
    playersJoined,
    totalSpots,
    playersNeeded,
    level,
    format,
    hostName,
    hostIdentityIds: hostIdentityIds.length > 0 ? hostIdentityIds : undefined,
    participants,
    raw: record,
  };
};

const extractMatchDetail = (payload: unknown): unknown => {
  if (!payload || typeof payload !== "object") return payload;
  const body = payload as Record<string, unknown>;

  if (body.match && typeof body.match === "object") return body.match;

  if (body.data && typeof body.data === "object") {
    const data = body.data as Record<string, unknown>;
    if (data.match && typeof data.match === "object") return data.match;
    if (data.data && typeof data.data === "object") {
      const nested = data.data as Record<string, unknown>;
      if (nested.match && typeof nested.match === "object") return nested.match;
    }
  }

  return payload;
};

export const normalizeMatchDetail = (
  record: unknown,
  options: { currentUser?: unknown } = {},
): NormalizedMatch => normalizeMatchRecord(extractMatchDetail(record), options);

export const listMatches = async ({ token, signal, ...params }: ListMatchesParams = {}) => {
  const query = buildMatchesQuery(params);
  const response = await request<unknown>("/matches", {
    query,
    token: token ?? undefined,
    signal,
  });

  const matches = extractMatchesArray(response);
  const pagination = extractPagination(response);

  return { matches, pagination, raw: response } satisfies MatchesResponse;
};

export const getMatchById = async (
  id: string | number,
  { token, signal }: { token?: string | null; signal?: AbortSignal } = {},
) => {
  const targetId = String(id);
  const baseParams = { token: token ?? undefined, signal } as const;

  const findMatch = (records: unknown[]) =>
    records.find((record) => deriveMatchId(record) === targetId) ?? null;

  const searchParameterSets: Partial<ListMatchesParams>[] = [
    {},
    { includeHidden: true },
    { includeHidden: true, hidden: true },
    { includeHidden: true, hiddenOnly: true },
    { status: "open" },
    { status: "upcoming" },
    { status: "draft" },
    { status: "archived" },
    { status: "draft", includeHidden: true, hidden: true },
    { status: "archived", includeHidden: true, hidden: true },
    { filter: "my" },
    { filter: "my", includeHidden: true },
    { filter: "my", includeHidden: true, hidden: true },
    { filter: "my", includeHidden: true, hiddenOnly: true },
    { filter: "my", status: "open" },
    { filter: "my", status: "upcoming" },
    { filter: "my", status: "draft" },
    { filter: "my", status: "archived" },
    { filter: "my", status: "draft", includeHidden: true, hidden: true },
    { filter: "my", status: "archived", includeHidden: true, hidden: true },
  ].filter((params, index, all) => {
    const serialized = JSON.stringify(params);
    return all.findIndex((other) => JSON.stringify(other) === serialized) === index;
  });

  const lookupBySearch = async (params?: Partial<ListMatchesParams>) => {
    const { matches } = await listMatches({
      search: targetId,
      perPage: 1,
      ...baseParams,
      ...params,
    });

    return findMatch(matches);
  };

  const lookupByPagination = async (params?: Partial<ListMatchesParams>) => {
    const perPage = Math.max(Number(params?.perPage) || 50, 1);
    let page = 1;
    let totalPages: number | undefined;

    while (true) {
      const { matches, pagination } = await listMatches({
        page,
        perPage,
        ...baseParams,
        ...params,
      });

      const match = findMatch(matches);
      if (match) return match;

      if (pagination?.perPage && pagination?.total) {
        totalPages = Math.max(Math.ceil(pagination.total / pagination.perPage), totalPages ?? 0);
      }

      const hasMorePages =
        (totalPages && page < totalPages) || (!totalPages && matches.length === perPage);
      if (!hasMorePages) break;

      page += 1;
    }

    return null;
  };

  for (const params of searchParameterSets) {
    const match = await lookupBySearch(params);
    if (match) return match;
  }

  for (const params of searchParameterSets) {
    const match = await lookupByPagination(params);
    if (match) return match;
  }

  throw new Error("Match not found");
};

