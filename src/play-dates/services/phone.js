export const formatPhoneNumber = (value) => {
  const phone = String(value || "").replace(/\D/g, "");
  const match = phone.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
  if (!match) return String(value || "");
  return !match[2]
    ? match[1]
    : `(${match[1]}) ${match[2]}${match[3] ? `-${match[3]}` : ""}`;
};

export const normalizePhoneValue = (value) => {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) {
    const cleaned = `+${trimmed.slice(1).replace(/\D/g, "")}`;
    return cleaned.length > 1 ? cleaned : "";
  }
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
};

export const getPhoneDigits = (value) => {
  if (!value) return "";
  return String(value).replace(/\D/g, "");
};

export const formatPhoneDisplay = (value) => {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  const clean = digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;
  if (clean.length === 10) {
    return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
  }
  return String(value);
};

