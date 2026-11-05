const LOCALE = "en-US";
const SHORT_DATE = new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric", timeZone: "UTC" });
const MONTH_AND_YEAR = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric", timeZone: "UTC" });

export function formatShortDate(date: string | Date) {
  return SHORT_DATE.format(new Date(date));
}

export function formatMonthAndYear(date: string | Date) {
  return MONTH_AND_YEAR.format(new Date(date));
}
