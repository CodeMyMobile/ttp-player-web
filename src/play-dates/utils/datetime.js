const pad = (value) => String(value).padStart(2, "0");

// Privacy settings (Brave, Firefox resistFingerprinting, Tor) make the browser
// claim to be on UTC. Our courts are all in Pacific time, so when the browser
// says UTC we read the picked wall-clock time as Pacific instead of sending
// it with +00:00 (match #512 was saved as 2 AM that way).
const FALLBACK_ZONE = "America/Los_Angeles";
const UTC_ZONES = new Set([
  "UTC",
  "Etc/UTC",
  "Etc/UCT",
  "UCT",
  "Etc/GMT",
  "Etc/GMT0",
  "Etc/GMT+0",
  "Etc/GMT-0",
  "GMT",
  "GMT0",
  "Etc/Greenwich",
  "Greenwich",
  "Etc/Universal",
  "Universal",
  "Etc/Zulu",
  "Zulu",
]);

const browserReportsUtc = () => {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return UTC_ZONES.has(zone) && new Date().getTimezoneOffset() === 0;
  } catch {
    return false;
  }
};

// Minutes east of UTC that `timeZone` is at the instant `ms`.
const zoneOffsetAt = (timeZone, ms) => {
  const parts = {};
  new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(new Date(ms))
    .forEach(({ type, value }) => {
      parts[type] = value;
    });
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - ms) / 60000);
};

const formatOffset = (offsetMinutes) => {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absolute = Math.abs(offsetMinutes);
  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
};

// The wall-clock time as an ISO string with `timeZone`'s offset on that date.
const zonedWallClockToIso = (year, month, day, hour, minute, timeZone) => {
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const firstGuess = zoneOffsetAt(timeZone, wallAsUtc);
  const offset = zoneOffsetAt(timeZone, wallAsUtc - firstGuess * 60000);
  const wall = new Date(wallAsUtc);
  return `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(
    wall.getUTCDate(),
  )}T${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}:00${formatOffset(
    offset,
  )}`;
};

const toIsoStringWithOffset = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  const offsetMinutes = date.getTimezoneOffset();
  const sign = offsetMinutes > 0 ? "-" : "+";
  const absolute = Math.abs(offsetMinutes);
  const offsetHours = pad(Math.floor(absolute / 60));
  const offsetMins = pad(absolute % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMins}`;
};

const combineDateAndTimeToIso = (dateString, timeString) => {
  if (!dateString || !timeString) return null;

  const [yearStr, monthStr, dayStr] = dateString.split("-");
  const [hourStr, minuteStr] = timeString.split(":");

  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  if (
    [year, month, day, hour, minute].some(
      (value) => !Number.isFinite(value),
    )
  ) {
    return null;
  }

  if (browserReportsUtc()) {
    try {
      return zonedWallClockToIso(year, month, day, hour, minute, FALLBACK_ZONE);
    } catch {
      // No time zone data: fall through to the device offset.
    }
  }

  const localDate = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(localDate.getTime())) {
    return null;
  }

  return toIsoStringWithOffset(localDate);
};

export { combineDateAndTimeToIso, toIsoStringWithOffset, zonedWallClockToIso };
