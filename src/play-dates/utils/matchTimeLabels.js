// Display formatters for match day/time. Shared by WhenPicker and the
// multi-match flow. Kept separate from components so fast-refresh stays happy.
const pad = (value) => String(value).padStart(2, "0");

export const formatDayLabel = (isoDate) => {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

export const formatTimeLabel = (time24) => {
  if (!time24) return "";
  const [h, mm] = time24.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return "";
  const ap = h >= 12 ? "PM" : "AM";
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return `${hh}:${pad(mm)} ${ap}`;
};
