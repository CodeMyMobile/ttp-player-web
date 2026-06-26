import { formatPhoneNumber, getPhoneDigits } from "../services/phone.js";

// Re-export the shared phone helpers so AuthDrawer can format/normalize from one place.
export { formatPhoneNumber, getPhoneDigits };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateEmail = (value) => {
  const email = String(value || "").trim();
  if (!email) return "Email is required.";
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address.";
  return "";
};

// Phone is optional on sign-up; only validate when something was typed.
export const validatePhone = (value, { required = false } = {}) => {
  const digits = getPhoneDigits(value);
  if (!digits) return required ? "Phone number is required." : "";
  if (digits.length !== 10) return "Enter a 10-digit US phone number.";
  return "";
};

export const validatePassword = (value, { isSignup = false } = {}) => {
  const password = String(value || "");
  if (!password) return "Password is required.";
  if (isSignup && password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return "";
};

export const validateName = (value, label = "Name") => {
  if (!String(value || "").trim()) return `${label} is required.`;
  return "";
};
