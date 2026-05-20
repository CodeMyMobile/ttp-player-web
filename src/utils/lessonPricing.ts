export type LessonCheckoutType = "private" | "semi-private" | "group" | "open-group";

export type LessonPricingInput = {
  hourly_rate?: number | string | null;
  group_price_per_person?: number | string | null;
  discount_percentage?: number | string | null;
  lesson_type_name?: string | null;
  lessontype_id?: number | string | null;
};

export type LessonPricingBreakdown = {
  checkoutType: LessonCheckoutType;
  isOpenGroup: boolean;
  basePrice: number;
  coachFee: number;
  creditFee: number;
  serviceFee: number;
  totalFee: number;
  stripeAmountCents: number;
  discountPercentage: number;
};

export type LessonCreditType = "private" | "semi" | "group";

const SERVICE_FEE = 1;
const CREDIT_FEE_PERCENTAGE = 3;

const round2 = (value: number) => Math.round(value * 100) / 100;

const parseNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.replace(/[^0-9.\-]/g, ""));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
};

export const resolveLessonCheckoutType = ({
  lesson_type_name,
  lessontype_id,
}: Pick<LessonPricingInput, "lesson_type_name" | "lessontype_id">): LessonCheckoutType => {
  const normalizedName = String(lesson_type_name ?? "").trim().toLowerCase();
  const typeId = parseNumber(lessontype_id);

  if (normalizedName === "open group" || normalizedName.includes("open group")) return "open-group";
  if (typeId === 2 || normalizedName.includes("semi")) return "semi-private";
  if (typeId === 3 || typeId === 4 || normalizedName.includes("group")) return "group";
  return "private";
};

export const calculateLessonPricing = (input: LessonPricingInput): LessonPricingBreakdown => {
  const checkoutType = resolveLessonCheckoutType(input);
  const basePrice =
    checkoutType === "private"
      ? parseNumber(input.hourly_rate)
      : parseNumber(input.group_price_per_person);
  const discountPercentage = Math.min(Math.max(parseNumber(input.discount_percentage), 0), 100);
  const coachFee = round2(basePrice - (basePrice * discountPercentage) / 100);
  const creditFee = round2(coachFee * (CREDIT_FEE_PERCENTAGE / 100));
  const totalFee = round2(coachFee + creditFee + SERVICE_FEE);

  return {
    checkoutType,
    isOpenGroup: checkoutType === "open-group",
    basePrice,
    coachFee,
    creditFee,
    serviceFee: SERVICE_FEE,
    totalFee,
    stripeAmountCents: Math.round(totalFee * 100),
    discountPercentage,
  };
};

export const resolveLessonCreditType = ({
  lesson_type_name,
  lessontype_id,
}: Pick<LessonPricingInput, "lesson_type_name" | "lessontype_id">): LessonCreditType => {
  const checkoutType = resolveLessonCheckoutType({ lesson_type_name, lessontype_id });
  if (checkoutType === "semi-private") return "semi";
  if (checkoutType === "group" || checkoutType === "open-group") return "group";
  return "private";
};

export const normalizePackageLessonCreditType = (value: string): LessonCreditType => {
  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (normalized.includes("semi")) return "semi";
  if (normalized.includes("group")) return "group";
  return "private";
};

export const packageAllowsLessonCreditType = (
  allowedTypes: string[] | undefined,
  lessonType: LessonCreditType,
) => {
  if (!Array.isArray(allowedTypes) || allowedTypes.length === 0) {
    return true;
  }
  return allowedTypes.some((type) => normalizePackageLessonCreditType(type) === lessonType);
};
