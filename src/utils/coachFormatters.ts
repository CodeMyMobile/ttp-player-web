import { useMemo } from 'react';

export interface CoachAvailabilityWindow {
  day?: string | null;
  days?: Array<string | null> | null;
  weekday?: string | null;
  start?: string | null;
  end?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  from?: string | null;
  to?: string | null;
  [key: string]: unknown;
}

export interface CoachAvailabilityCollection {
  summary?: string | null;
  description?: string | null;
  windows?: CoachAvailabilityWindow[] | null;
  slots?: CoachAvailabilityWindow[] | null;
  availability?: CoachAvailabilityWindow[] | null;
  [key: string]: unknown;
}

export interface CoachLocationLike {
  id?: string | number | null;
  name?: string | null;
  title?: string | null;
  venue?: string | null;
  facility?: string | null;
  location?: string | null;
  club?: string | null;
  club_name?: string | null;
  location_name?: string | null;
  city?: string | null;
  city_name?: string | null;
  cityName?: string | null;
  state?: string | null;
  state_name?: string | null;
  stateName?: string | null;
  stateCode?: string | null;
  state_code?: string | null;
  province?: string | null;
  region?: string | null;
  address?: {
    city?: string | null;
    state?: string | null;
    stateCode?: string | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export interface FormattedCoachLocations {
  /** Labels for every location */
  all: string[];
  /** Labels that should be shown before the "+N more" control */
  visible: string[];
  /** Number of locations hidden behind the expander */
  hiddenCount: number;
}

export const AVAILABILITY_FALLBACK = 'Availability on request.';
export const RATE_FALLBACK = 'Rate varies';

const DAY_ORDER: ReadonlyArray<string> = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const DAY_LABEL: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

const dayToIndex = new Map(DAY_ORDER.map((day, index) => [day, index] as const));

const normalizeDay = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase();
  if (DAY_ORDER.includes(normalized)) {
    return normalized;
  }
  // Handle common abbreviations
  switch (normalized) {
    case 'mon':
      return 'monday';
    case 'tue':
    case 'tues':
      return 'tuesday';
    case 'wed':
      return 'wednesday';
    case 'thu':
    case 'thur':
    case 'thurs':
      return 'thursday';
    case 'fri':
      return 'friday';
    case 'sat':
      return 'saturday';
    case 'sun':
      return 'sunday';
    case 'weekday':
    case 'weekdays':
      return null;
    case 'weekend':
    case 'weekends':
      return null;
    default:
      return null;
  }
};

const collectDays = (source: unknown): string[] => {
  if (!source) return [];
  if (Array.isArray(source)) {
    const flattened = source
      .flatMap((item) => {
        if (typeof item === 'string') {
          return item
            .split(/[,&/]+/)
            .map((part) => normalizeDay(part))
            .filter((part): part is string => Boolean(part));
        }
        if (item && typeof item === 'object' && 'day' in (item as Record<string, unknown>)) {
          return collectDays([(item as Record<string, unknown>).day]);
        }
        return normalizeDay(item as string | undefined) ?? [];
      })
      .filter(Boolean) as string[];
    return Array.from(new Set(flattened));
  }
  if (typeof source === 'string') {
    return collectDays(source.split(/[,&/]+/));
  }
  if (source && typeof source === 'object') {
    const record = source as Record<string, unknown>;
    if ('days' in record && Array.isArray(record.days)) {
      return collectDays(record.days);
    }
    if ('day' in record) {
      return collectDays([record.day]);
    }
    if ('weekday' in record) {
      return collectDays([record.weekday]);
    }
  }
  return [];
};

const normalizeTime = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const hours = Math.floor(value);
    const minutes = Math.round((value - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{1,2}:\d{2}$/u.test(trimmed)) {
      const [hours, minutes] = trimmed.split(':');
      return `${hours.padStart(2, '0')}:${minutes}`;
    }
    if (/^\d{1,2}$/u.test(trimmed)) {
      const hours = trimmed.padStart(2, '0');
      return `${hours}:00`;
    }
    const isoMatch = trimmed.match(/(\d{2}):(\d{2})/u);
    if (isoMatch) {
      return `${isoMatch[1]}:${isoMatch[2]}`;
    }
  }
  return null;
};

const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(':');
  const date = new Date(Date.UTC(1970, 0, 1, Number(hours), Number(minutes || '0')));
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: minutes !== '00' ? '2-digit' : undefined,
    hour12: true,
  });
  const parts = formatter.formatToParts(date);
  const hourPart = parts.find((part) => part.type === 'hour')?.value ?? hours;
  const minutePart = parts.find((part) => part.type === 'minute')?.value;
  const dayPeriod = parts.find((part) => part.type === 'dayPeriod')?.value.toLowerCase() ?? '';
  return `${hourPart}${minutePart ? `:${minutePart}` : ''}${dayPeriod}`;
};

const formatTimeRange = (start: string, end: string) => `${formatTime(start)}–${formatTime(end)}`;

interface NormalizedWindow {
  days: string[];
  start: string;
  end: string;
}

const toNormalizedWindow = (candidate: CoachAvailabilityWindow): NormalizedWindow | null => {
  const days = collectDays(candidate.days ?? candidate.day ?? candidate.weekday);
  const start =
    normalizeTime(candidate.start ?? candidate.startTime ?? candidate.from ?? candidate.begin ?? candidate.start_time) ??
    null;
  const end =
    normalizeTime(candidate.end ?? candidate.endTime ?? candidate.to ?? candidate.finish ?? candidate.end_time) ??
    null;
  if (!days.length || !start || !end) {
    return null;
  }
  return { days, start, end };
};

const flattenAvailability = (input: unknown): CoachAvailabilityWindow[] => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.flatMap((item) => flattenAvailability(item));
  }
  if (typeof input === 'string') {
    return [{ summary: input } as CoachAvailabilityWindow];
  }
  if (typeof input === 'object') {
    const record = input as CoachAvailabilityCollection;
    if (record.summary) {
      return [{ summary: record.summary } as CoachAvailabilityWindow];
    }
    if (Array.isArray(record.windows)) {
      return record.windows;
    }
    if (Array.isArray(record.slots)) {
      return record.slots;
    }
    if (Array.isArray(record.availability)) {
      return record.availability;
    }
    if (Array.isArray((record as Record<string, unknown>).items)) {
      return flattenAvailability((record as Record<string, unknown>).items);
    }
    return [record as CoachAvailabilityWindow];
  }
  return [];
};

export const formatCoachAvailability = (source: unknown): string => {
  if (!source) {
    return AVAILABILITY_FALLBACK;
  }
  if (typeof source === 'string') {
    const trimmed = source.trim();
    return trimmed || AVAILABILITY_FALLBACK;
  }

  const windows = flattenAvailability(source)
    .map((window) => toNormalizedWindow(window))
    .filter((window): window is NormalizedWindow => Boolean(window));

  if (!windows.length) {
    if (typeof source === 'object' && source && 'description' in (source as Record<string, unknown>)) {
      const description = String((source as Record<string, unknown>).description ?? '').trim();
      return description || AVAILABILITY_FALLBACK;
    }
    return AVAILABILITY_FALLBACK;
  }

  const grouped = new Map<string, Set<string>>();
  windows.forEach((window) => {
    const key = `${window.start}|${window.end}`;
    if (!grouped.has(key)) {
      grouped.set(key, new Set());
    }
    window.days.forEach((day) => grouped.get(key)?.add(day));
  });

  const segments = Array.from(grouped.entries()).map(([key, days]) => {
    const [start, end] = key.split('|');
    const orderedDays = Array.from(days)
      .filter((day) => dayToIndex.has(day))
      .sort((a, b) => (dayToIndex.get(a)! < dayToIndex.get(b)! ? -1 : 1));

    if (!orderedDays.length) {
      return formatTimeRange(start, end);
    }

    const ranges: Array<{ start: string; end: string }> = [];
    let rangeStart = orderedDays[0];
    let previous = orderedDays[0];

    for (let index = 1; index < orderedDays.length; index += 1) {
      const current = orderedDays[index];
      const prevIndex = dayToIndex.get(previous)!;
      const currentIndex = dayToIndex.get(current)!;
      if (currentIndex - prevIndex === 1) {
        previous = current;
        continue;
      }
      ranges.push({ start: rangeStart, end: previous });
      rangeStart = current;
      previous = current;
    }
    ranges.push({ start: rangeStart, end: previous });

    const label = ranges
      .map(({ start: startDay, end: endDay }) => {
        const startIndex = dayToIndex.get(startDay)!;
        const endIndex = dayToIndex.get(endDay)!;
        const length = endIndex - startIndex + 1;
        if (length === 7) {
          return 'Daily';
        }
        if (length === 5 && startIndex === 0) {
          return 'Weekdays';
        }
        if (length === 2 && startIndex === 5) {
          return 'Weekend';
        }
        if (length > 1) {
          return `${DAY_LABEL[startDay]}–${DAY_LABEL[endDay]}`;
        }
        return DAY_LABEL[startDay];
      })
      .join(', ');

    return `${label} ${formatTimeRange(start, end)}`.trim();
  });

  return segments.join('; ');
};

const pickFirstString = (candidates: Array<unknown | undefined | null>): string | null => {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
};

const normalizeState = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^[A-Za-z]{2}$/u.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  if (/^[A-Za-z]+$/u.test(trimmed)) {
    return trimmed.replace(/\b\w/g, (match) => match.toUpperCase());
  }
  return trimmed;
};

const normalizeLocationRecord = (entry: unknown, index: number): string | null => {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    return trimmed || null;
  }
  if (typeof entry === 'object') {
    const record = entry as CoachLocationLike;
    const name = pickFirstString([
      record.name,
      record.title,
      record.venue,
      record.facility,
      record.location,
      record.club,
      record.club_name,
      record.location_name,
    ]);
    const city = pickFirstString([
      record.city,
      record.city_name,
      record.cityName,
      record.address?.city,
    ]);
    const state = normalizeState(
      pickFirstString([
        record.state,
        record.state_name,
        record.stateName,
        record.stateCode,
        record.state_code,
        record.address?.state,
        record.address?.stateCode,
        record.province,
        record.region,
      ]),
    );

    const cityState = [city, state].filter(Boolean).join(', ');

    if (name && cityState) {
      return `${name} — ${cityState}`;
    }
    if (name) {
      return name;
    }
    if (cityState) {
      return cityState;
    }
    if (city) {
      return city;
    }
    if (state) {
      return state;
    }
    const fallback = (record as Record<string, unknown>).displayName ?? null;
    if (typeof fallback === 'string') {
      return fallback.trim() || null;
    }
    if ('address' in record && typeof record.address === 'string') {
      const sanitized = record.address.replace(/\b\d{5}(?:-\d{4})?\b/gu, '').trim();
      return sanitized || null;
    }
    return name ?? null;
  }
  return index.toString();
};

export const formatCoachLocations = (source: unknown, maxVisible = 2): FormattedCoachLocations => {
  const entries: unknown[] = [];
  if (!source) {
    return { all: [], visible: [], hiddenCount: 0 };
  }
  if (Array.isArray(source)) {
    entries.push(...source);
  } else if (typeof source === 'object') {
    const record = source as Record<string, unknown>;
    if (Array.isArray(record.locations)) {
      entries.push(...record.locations);
    } else if (Array.isArray(record.venues)) {
      entries.push(...record.venues);
    } else if (Array.isArray(record.items)) {
      entries.push(...record.items);
    } else if (record.primary) {
      entries.push(record.primary);
      if (Array.isArray(record.others)) {
        entries.push(...record.others);
      }
    } else {
      entries.push(record);
    }
  } else if (typeof source === 'string') {
    entries.push(...source.split(/\r?\n|\|/));
  }

  const labels = entries
    .map((entry, index) => normalizeLocationRecord(entry, index))
    .filter((label): label is string => Boolean(label))
    .map((label) => label.replace(/\b\d{5}(?:-\d{4})?\b/gu, '').replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim());

  const unique = Array.from(new Set(labels));
  const visible = unique.slice(0, Math.max(1, maxVisible));
  const hiddenCount = Math.max(unique.length - visible.length, 0);

  return { all: unique, visible, hiddenCount };
};

export const useCoachHeadline = (summary: string | undefined | null, fallback = 'Coach profile') =>
  useMemo(() => {
    if (!summary) return fallback;
    const trimmed = summary.trim();
    if (!trimmed) return fallback;
    const limit = 160;
    if (trimmed.length <= limit) return trimmed;
    const truncated = trimmed.slice(0, limit);
    const safe = truncated.replace(/[\s\u00A0]+$/u, '');
    return `${safe}…`;
  }, [summary, fallback]);

export interface CoachRateCandidate {
  amount?: number | string | null;
  value?: number | string | null;
  currency?: string | null;
  display?: string | null;
  formatted?: string | null;
  [key: string]: unknown;
}

const parseNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
};

export interface CoachRateDisplay {
  amount?: number;
  currency?: string;
  display: string;
}

const formatCurrency = (amount: number, currency?: string) => {
  try {
    if (currency) {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(amount);
    }
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch (error) {
    return `$${Math.round(amount)}`;
  }
};

export const formatCoachRate = (source: unknown): CoachRateDisplay => {
  if (!source) {
    return { display: RATE_FALLBACK };
  }

  const directString = typeof source === 'string' ? source.trim() : null;
  if (directString) {
    return { display: directString };
  }

  const candidates: CoachRateCandidate[] = [];
  if (typeof source === 'object') {
    const record = source as Record<string, unknown>;
    if (typeof record.display === 'string') {
      return { display: record.display.trim() };
    }
    if (typeof record.formatted === 'string') {
      return { display: record.formatted.trim() };
    }
    if ('amount' in record || 'value' in record) {
      candidates.push({
        amount: record.amount as number | string | null,
        value: record.value as number | string | null,
        currency: record.currency as string | null,
      });
    }
    if ('lessonRate' in record && typeof record.lessonRate === 'object') {
      candidates.push(record.lessonRate as CoachRateCandidate);
    }
    if ('lesson_rate' in record && typeof record.lesson_rate === 'object') {
      candidates.push(record.lesson_rate as CoachRateCandidate);
    }
    if ('hourlyRate' in record) {
      candidates.push({ amount: record.hourlyRate as number | string | null, currency: record.currency as string | null });
    }
    if ('hourly_rate' in record) {
      candidates.push({ amount: record.hourly_rate as number | string | null, currency: record.currency as string | null });
    }
    if ('rate' in record) {
      candidates.push({ amount: record.rate as number | string | null, currency: record.currency as string | null });
    }
    if ('price_per_hour' in record) {
      candidates.push({ amount: record.price_per_hour as number | string | null, currency: record.currency as string | null });
    }
    if (Array.isArray(record.rates)) {
      record.rates.forEach((rate) => {
        if (rate && typeof rate === 'object') {
          candidates.push(rate as CoachRateCandidate);
        }
      });
    }
  }

  for (const candidate of candidates) {
    const amount = parseNumber(candidate.amount ?? candidate.value);
    if (amount !== null) {
      return {
        amount,
        currency: candidate.currency ?? undefined,
        display: `${formatCurrency(amount, candidate.currency)} / hr`,
      };
    }
    const display = pickFirstString([
      candidate.display,
      candidate.formatted,
    ]);
    if (display) {
      return { display };
    }
  }

  return { display: RATE_FALLBACK };
};

export const buildCoachInitials = (name: string | undefined | null): string => {
  if (!name) return 'CC';
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return 'CC';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export interface RawCoach extends Record<string, unknown> {}

export interface NormalizedCoach {
  id: string;
  slug: string;
  name: string;
  headline: string;
  bio?: string;
  availability: string;
  availabilitySource?: unknown;
  rate: CoachRateDisplay;
  avatarUrl?: string;
  initials: string;
  locations: FormattedCoachLocations;
}

const extractCoachId = (coach: RawCoach): string | null => {
  const candidates = [
    coach.id,
    coach.coach_id,
    coach.user_id,
    coach.uuid,
    coach.player_coach_id,
    coach.slug,
    coach.username,
  ];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      const normalized = String(candidate);
      if (normalized) {
        return normalized;
      }
    }
  }
  return null;
};

const extractCoachName = (coach: RawCoach): string | null => {
  const firstName = pickFirstString([coach.first_name as string, coach.firstName as string]);
  const lastName = pickFirstString([coach.last_name as string, coach.lastName as string]);
  const full = pickFirstString([
    coach.name as string,
    coach.full_name as string,
    coach.fullName as string,
    coach.coach_name as string,
    coach.display_name as string,
  ]);
  const combined = full || [firstName, lastName].filter(Boolean).join(' ');
  return combined || null;
};

const extractCoachBio = (coach: RawCoach): string | null =>
  pickFirstString([
    coach.headline as string,
    coach.bio as string,
    coach.short_bio as string,
    coach.summary as string,
    coach.description as string,
    coach.about as string,
  ]);

const extractCoachAvatar = (coach: RawCoach): string | null =>
  pickFirstString([
    coach.profile_image_url as string,
    coach.profile_image as string,
    coach.profilePhoto as string,
    coach.avatar as string,
    coach.photo as string,
    coach.image as string,
  ]);

const extractCoachAvailability = (coach: RawCoach): unknown =>
  coach.availability ??
  coach.availability_summary ??
  coach.schedule_summary ??
  coach.schedule ??
  coach.next_available ??
  coach.availabilityBlocks ??
  coach.availability_blocks ??
  coach.scheduleBlocks ??
  coach.schedule_blocks;

const extractCoachRate = (coach: RawCoach): unknown =>
  coach.rate ??
  coach.hourly_rate ??
  coach.hourlyRate ??
  coach.price_per_hour ??
  coach.hourly_price ??
  coach.lesson_rate ??
  coach.lessonRate ??
  coach.private_lesson_rate ??
  coach.privateLessonRate ??
  coach.pricing ??
  coach.rates;

const extractCoachLocations = (coach: RawCoach): unknown =>
  coach.locations ??
  coach.venues ??
  coach.facilities ??
  coach.location_list ??
  coach.locationList ??
  coach.coach_locations ??
  coach.coachLocations ??
  coach.location_names ??
  coach.locationName ??
  coach.location ??
  coach.primary_location ??
  coach.club ??
  coach.club_name ??
  coach.facility;

export const normalizeCoach = (coach: RawCoach): NormalizedCoach | null => {
  if (!coach) return null;
  const id = extractCoachId(coach);
  if (!id) return null;
  const name = extractCoachName(coach) ?? 'Coach';
  const bio = extractCoachBio(coach) ?? undefined;
  const availabilitySource = extractCoachAvailability(coach);
  const availability = formatCoachAvailability(availabilitySource);
  const rate = formatCoachRate(extractCoachRate(coach));
  const avatarUrl = extractCoachAvatar(coach) ?? undefined;
  const initials = buildCoachInitials(name);
  const locations = formatCoachLocations(extractCoachLocations(coach));
  const headline = bio ? (bio.length > 160 ? `${bio.slice(0, 160).replace(/[\s\u00A0]+$/u, '')}…` : bio) : 'Coach profile';
  const slug = (coach.slug as string) ?? (coach.username as string) ?? id;

  return {
    id,
    slug,
    name,
    headline,
    bio,
    availability,
    availabilitySource,
    rate,
    avatarUrl,
    initials,
    locations,
  };
};

export const extractCoaches = (payload: unknown): RawCoach[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.filter((item): item is RawCoach => Boolean(item && typeof item === 'object'));
  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.data)) {
      return extractCoaches(record.data);
    }
    if (Array.isArray(record.results)) {
      return extractCoaches(record.results);
    }
    if (Array.isArray(record.coaches)) {
      return extractCoaches(record.coaches);
    }
    if (Array.isArray(record.items)) {
      return extractCoaches(record.items);
    }
  }
  return [];
};
