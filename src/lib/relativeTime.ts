const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const from = Date.parse(iso);
  if (Number.isNaN(from)) return "";
  const sec = Math.max(0, Math.round((now - from) / 1000));
  if (sec < 45) return "just now";
  return `${countLabel(sec)} ago`;
}

function countLabel(sec: number): string {
  if (sec < HOUR) return units(Math.max(1, Math.round(sec / MINUTE)), "minute");
  if (sec < DAY) return units(Math.max(1, Math.round(sec / HOUR)), "hour");
  if (sec < WEEK) return units(Math.max(1, Math.round(sec / DAY)), "day");
  if (sec < MONTH) return units(Math.max(1, Math.round(sec / WEEK)), "week");
  if (sec < YEAR) return units(Math.max(1, Math.round(sec / MONTH)), "month");
  return units(Math.max(1, Math.round(sec / YEAR)), "year");
}

function units(count: number, unit: string): string {
  return count === 1 ? `1 ${unit}` : `${count} ${unit}s`;
}

export function formatLocalDateTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}
