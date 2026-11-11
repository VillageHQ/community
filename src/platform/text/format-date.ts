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

const DAY_MONTH_PARTS = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

// Founderhall's date: "5 Nov", never a year ("fresh as of 5 Nov", "Connected 22 Oct").
export function formatDayMonth(date: string | Date) {
  return DAY_MONTH_PARTS.format(new Date(date)).replace("Sept", "Sep");
}

// Founderhall's day: "1 Sep", with the year when it is not this year ("1 Sep 2025").
export function formatDay(date: string | Date, now = new Date()) {
  const day = new Date(date);
  const year = day.getUTCFullYear();
  return year === now.getUTCFullYear() ? formatDayMonth(day) : `${formatDayMonth(day)} ${year}`;
}
