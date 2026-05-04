const MATCH_FORMAT_OPTIONS = [
  { value: "Singles", label: "Singles" },
  { value: "Doubles", label: "Doubles" },
  { value: "Mixed Doubles", label: "Mixed Doubles" },
  { value: "Dingles", label: "Dingles" },
  { value: "Round Robin", label: "Round Robin" },
  { value: "Other", label: "Other" },
];

const SKILL_LEVEL_OPTIONS = [
  { value: "2.5", label: "2.5", desc: "Beginner" },
  { value: "3.0", label: "3.0", desc: "Developing" },
  { value: "3.5", label: "3.5", desc: "Intermediate" },
  { value: "4.0", label: "4.0", desc: "Advanced" },
  { value: "4.5", label: "4.5+", desc: "Expert" },
];

const ensureOptionPresent = (options, value) => {
  if (!value) return options;
  const normalized = String(value).trim();
  if (!normalized) return options;
  const exists = options.some((option) => option.value === normalized);
  if (exists) return options;
  return [...options, { value: normalized, label: normalized }];
};

const isValidOptionValue = (options, value) => {
  if (!value) return true;
  return options.some((option) => option.value === value);
};

export {
  MATCH_FORMAT_OPTIONS,
  SKILL_LEVEL_OPTIONS,
  ensureOptionPresent,
  isValidOptionValue,
};
