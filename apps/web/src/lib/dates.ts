const DAY_MS = 86_400_000;

/** Inclusive list of YYYY-MM-DD dates (UTC arithmetic on calendar dates, no time zones). */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += DAY_MS) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

const longFormat = new Intl.DateTimeFormat("en-NG", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const shortFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", timeZone: "UTC" });

/** "Sun, 25 Oct 2026" for a calendar date. */
export function formatDate(date: string): string {
  return longFormat.format(new Date(`${date}T00:00:00Z`));
}

/** "25 Oct" for a calendar date. */
export function formatShortDate(date: string): string {
  return shortFormat.format(new Date(`${date}T00:00:00Z`));
}

/** Local time in Lagos for an event timestamp. */
export function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(iso));
}

export function isDateOnly(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** "1 Oct – 23 Oct (23 days)" for a consecutive run, otherwise a short list. */
export function describeDates(dates: string[]): string {
  if (dates.length === 0) return "—";
  if (dates.length === 1) return formatShortDate(dates[0]);
  const first = Date.parse(`${dates[0]}T00:00:00Z`);
  const last = Date.parse(`${dates[dates.length - 1]}T00:00:00Z`);
  const consecutive = (last - first) / 86_400_000 === dates.length - 1;
  if (consecutive) {
    return `${formatShortDate(dates[0])} – ${formatShortDate(dates[dates.length - 1])} (${dates.length} days)`;
  }
  return dates.length <= 4
    ? dates.map(formatShortDate).join(", ")
    : `${dates.slice(0, 3).map(formatShortDate).join(", ")} +${dates.length - 3} more`;
}
