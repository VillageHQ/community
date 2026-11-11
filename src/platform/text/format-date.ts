const LOCALE = "en-US";
const SHORT_DATE = new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric", timeZone: "UTC" });
const LONG_DATE = new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const DATE_AND_TIME = new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });
const MONTH_AND_YEAR = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric", timeZone: "UTC" });

export function formatShortDate(date: string | Date) {
  return SHORT_DATE.format(new Date(date));
}

export function formatMonthAndYear(date: string | Date) {
  return MONTH_AND_YEAR.format(new Date(date));
}

export function formatLongDate(date: string | Date) {
  return LONG_DATE.format(new Date(date));
}

export function formatDateAndTimeUtc(date: string | Date) {
  return `${DATE_AND_TIME.format(new Date(date))} UTC`;
}

// Founderhall's dates on admin pages: "11 Nov" and "11 Nov 15:13 UTC" (24-hour, no year).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDayMonth(date: string | Date) {
  const day = new Date(date);
  return `${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]}`;
}

export function formatDayMonthTimeUtc(date: string | Date) {
  const moment = new Date(date);
  const time = `${String(moment.getUTCHours()).padStart(2, "0")}:${String(moment.getUTCMinutes()).padStart(2, "0")}`;
  return `${formatDayMonth(moment)} ${time} UTC`;
}
