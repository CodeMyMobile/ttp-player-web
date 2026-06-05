import moment from "moment";

import { request } from "./http";
import type { GroupLesson, GroupLessonLevel } from "./groupLessons";

export interface MindbodyClassRow {
  id: number | string;
  partner_id?: number | string;
  mindbody_class_id?: number | string;
  name?: string;
  description?: string | null;
  instructor_name?: string | null;
  location?: string | null;
  start_date_time?: string;
  end_date_time?: string;
  max_capacity?: number | string | null;
  total_booked?: number | string | null;
  open_spots?: number | string | null;
  is_full?: boolean;
  class_price_cents?: number | string | null;
  partner_name?: string | null;
  platform_fee_amount_cents?: number | string | null;
  stripe_connected_account_id?: string | null;
  require_payment?: boolean;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface MindbodyClassesResponse {
  classes?: MindbodyClassRow[];
  data?: MindbodyClassRow[];
  results?: MindbodyClassRow[];
  pagination?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface MindbodyClassResponse {
  class?: MindbodyClassRow;
  data?: MindbodyClassRow;
  [key: string]: unknown;
}

export interface FetchMindbodyClassesParams {
  token?: string;
  perPage?: number;
  page?: number;
  search?: string;
  filters?: {
    from?: string;
    to?: string;
  };
  signal?: AbortSignal;
}

const buildRequestBody = <T extends Record<string, unknown>>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== ""),
  ) as T;

const parseNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const centsToPrice = (cents: unknown) => {
  const amount = parseNumber(cents, 0) / 100;
  return `$${amount.toFixed(2)} per player`;
};

const normalizeDateBoundary = (value: string | undefined, boundary: "start" | "end") => {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parsed = moment.utc(value, "YYYY-MM-DD", true);
  if (!parsed.isValid()) return value;
  return (boundary === "start" ? parsed.startOf("day") : parsed.endOf("day")).toISOString();
};

export const extractMindbodyClasses = (response: MindbodyClassesResponse | null | undefined) => {
  if (!response) return [] as MindbodyClassRow[];
  if (Array.isArray(response.classes)) return response.classes;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.results)) return response.results;
  return [];
};

export const getMindbodyClassFromResponse = (response: MindbodyClassResponse) =>
  response.class ?? response.data;

export const fetchMindbodyClasses = ({
  token,
  perPage,
  page,
  search,
  filters,
  signal,
}: FetchMindbodyClassesParams) =>
  request<MindbodyClassesResponse>("/player/mindbody/classes", {
    method: "POST",
    token,
    authScheme: "Token",
    signal,
    query: {
      per_page: perPage,
      page,
    },
    body: buildRequestBody({
      q: search?.trim(),
      from: normalizeDateBoundary(filters?.from, "start"),
      to: normalizeDateBoundary(filters?.to, "end"),
    }),
  });

export const fetchMindbodyClassById = ({
  token,
  classId,
  signal,
}: {
  token?: string;
  classId: number | string;
  signal?: AbortSignal;
}) =>
  request<MindbodyClassResponse>(`/player/mindbody/classes/${classId}`, {
    token,
    authScheme: "Token",
    signal,
  });

export const bookMindbodyClass = ({
  token,
  classId,
  paymentMethodId,
  sendEmail = true,
}: {
  token?: string;
  classId: number | string;
  paymentMethodId?: string;
  sendEmail?: boolean;
}) =>
  request<Record<string, unknown>>(`/player/mindbody/classes/${classId}/book`, {
    method: "POST",
    token,
    authScheme: "Token",
    body: buildRequestBody({
      payment_method_id: paymentMethodId,
      send_email: sendEmail,
    }),
  });

export const mapMindbodyClassToGroupLesson = (mindbodyClass: MindbodyClassRow): GroupLesson => {
  const start = mindbodyClass.start_date_time ? moment.utc(mindbodyClass.start_date_time) : null;
  const end = mindbodyClass.end_date_time ? moment.utc(mindbodyClass.end_date_time) : null;
  const totalSpots = parseNumber(mindbodyClass.max_capacity, 0);
  const bookedSpots = parseNumber(mindbodyClass.total_booked, 0);
  const openSpots =
    mindbodyClass.open_spots !== undefined && mindbodyClass.open_spots !== null
      ? parseNumber(mindbodyClass.open_spots, 0)
      : Math.max(totalSpots - bookedSpots, 0);
  const locationName = mindbodyClass.location?.trim() || "Partner location";
  const partnerName = mindbodyClass.partner_name?.trim() || "Partner coach";
  const instructorName = mindbodyClass.instructor_name?.trim() || partnerName;
  const durationMinutes =
    start && end && start.isValid() && end.isValid()
      ? Math.max(end.diff(start, "minutes"), 0)
      : 60;

  return {
    id: `mindbody-${mindbodyClass.id}`,
    title: mindbodyClass.name || "Partner class",
    coachId: 0,
    coachName: instructorName,
    coachAvatarUrl: "",
    level: 3 as GroupLessonLevel,
    skillLabel: "Partner class",
    description:
      mindbodyClass.description?.trim() ||
      `${partnerName} class booked inside The Tennis Plan.`,
    day: start?.isValid() ? start.format("dddd") : "TBD",
    date: start?.isValid() ? start.format("MMM D") : "Date TBD",
    startTime: start?.isValid() ? start.format("h:mm A") : "Time TBD",
    startDateTime: mindbodyClass.start_date_time,
    endDateTime: mindbodyClass.end_date_time,
    durationMinutes,
    locationName,
    locationCity: locationName,
    distanceMiles: 0,
    totalSpots,
    availableSpots: mindbodyClass.is_full ? 0 : openSpots,
    focus: "Partner class",
    pricePerPlayer: centsToPrice(mindbodyClass.class_price_cents),
    participants: [],
    groupPlayers: [],
    isMindbody: true,
    partnerClassId: mindbodyClass.id,
    mindbodyClassId: mindbodyClass.mindbody_class_id,
    partnerName,
    platformFeeAmountCents: parseNumber(mindbodyClass.platform_fee_amount_cents, 0),
    classPriceCents: parseNumber(mindbodyClass.class_price_cents, 0),
    requireMindbodyPayment: Boolean(mindbodyClass.require_payment),
    sourceLesson: mindbodyClass,
  };
};
