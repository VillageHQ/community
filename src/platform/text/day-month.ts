// Founderhall's short date (its fmtDate()): "9 Nov", the day then the month's first three letters, in UTC.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function formatDayMonth(date: string | Date) {
  const day = new Date(date);
  return `${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]}`;
}

// The possessive of a name, with Founderhall's curly apostrophe: "Northwind Founders’", "Sam’s".
export function toPossessive(name: string) {
  const trimmed = name.trim();
  return /s$/i.test(trimmed) ? `${trimmed}’` : `${trimmed}’s`;
}

// Founderhall's fmtDay(): "1 Sep", with the year when it isn't this year ("1 Sep 2025").
export function formatDay(date: string | Date, now = new Date()) {
  const day = new Date(date);
  const year = day.getUTCFullYear();
  return year === now.getUTCFullYear() ? formatDayMonth(day) : `${formatDayMonth(day)} ${year}`;
}
