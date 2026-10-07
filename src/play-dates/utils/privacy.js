import { getPhoneDigits, normalizePhoneValue } from "../services/phone";

export const SHARE_PHONE_LABEL = "Share my phone with confirmed match partners";

export const normalizeSharePhone = (value) => value === true;

export const phoneContactHref = (phone) => {
  const digits = getPhoneDigits(phone);
  if (!digits) return "";
  return `tel:${normalizePhoneValue(phone) || digits}`;
};
