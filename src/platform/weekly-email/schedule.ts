import { z } from "zod";

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const THURSDAY = 4;
const NINE_AM = 9;
const LAST_HOUR = 23;
const LAST_WEEKDAY = 6;
const MAXIMUM_TIME_ZONE_LENGTH = 64;

export const DEFAULT_WEEKLY_SCHEDULE = { weekday: THURSDAY, hour: NINE_AM, timeZone: "UTC" } as const;

export const WEEKLY_SCHEDULE_KEYS = {
  weekday: "weekly_email_weekday",
  hour: "weekly_email_hour",
  timeZone: "weekly_email_time_zone",
} as const;

export function isTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const weeklyScheduleSchema = z.object({
  weekday: z.number().int().min(0).max(LAST_WEEKDAY),
  hour: z.number().int().min(0).max(LAST_HOUR),
  timeZone: z.string().trim().min(1).max(MAXIMUM_TIME_ZONE_LENGTH).refine(isTimeZone, "Pick a time zone from the list."),
});

export type WeeklySchedule = z.infer<typeof weeklyScheduleSchema>;

// A setting that is missing or unreadable falls back to the default, one field at a time.
export function parseWeeklySchedule(stored: ReadonlyMap<string, string>): WeeklySchedule {
  const weekday = Number(stored.get(WEEKLY_SCHEDULE_KEYS.weekday));
  const hour = Number(stored.get(WEEKLY_SCHEDULE_KEYS.hour));
  const timeZone = stored.get(WEEKLY_SCHEDULE_KEYS.timeZone) ?? "";
  return {
    weekday: Number.isInteger(weekday) && weekday >= 0 && weekday <= LAST_WEEKDAY ? weekday : DEFAULT_WEEKLY_SCHEDULE.weekday,
    hour: Number.isInteger(hour) && hour >= 0 && hour <= LAST_HOUR ? hour : DEFAULT_WEEKLY_SCHEDULE.hour,
    timeZone: timeZone && isTimeZone(timeZone) ? timeZone : DEFAULT_WEEKLY_SCHEDULE.timeZone,
  };
}

export function toScheduleSettings({ weekday, hour, timeZone }: WeeklySchedule) {
  return { [WEEKLY_SCHEDULE_KEYS.weekday]: String(weekday), [WEEKLY_SCHEDULE_KEYS.hour]: String(hour), [WEEKLY_SCHEDULE_KEYS.timeZone]: timeZone };
}

const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const formatters = new Map<string, Intl.DateTimeFormat>();

function readFormatter(timeZone: string) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

export function readLocalParts(moment: Date, timeZone: string) {
  const parts = readFormatter(timeZone).formatToParts(moment);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    weekday: SHORT_WEEKDAYS.indexOf(part("weekday")),
    hour: Number(part("hour")) % 24,
    minute: Number(part("minute")),
  };
}

// Every zone's offset is a whole number of quarter hours, so stepping by 15 minutes meets the
// local hour exactly, whatever the zone.
const STEP_MS = 15 * 60_000;
const STEPS_IN_EIGHT_DAYS = (8 * 24 * 60 * 60_000) / STEP_MS;

function isAtOrAfterSendTime(moment: Date, { weekday, hour, timeZone }: WeeklySchedule) {
  const local = readLocalParts(moment, timeZone);
  return local.weekday === weekday && local.hour >= hour;
}

// The first instant of the set day at or after the set hour. On a day the clocks skip that hour,
// that is the first time after the gap; on a day they repeat it, only its first pass counts.
function isScheduledMoment(moment: Date, schedule: WeeklySchedule) {
  return isAtOrAfterSendTime(moment, schedule) && !isAtOrAfterSendTime(new Date(moment.getTime() - STEP_MS), schedule);
}

export type WeeklyMoment = { weekKey: string; at: Date };

// The latest scheduled moment at or before `now`. Its local date names the week, so every
// server agrees on which week it is without storing anything.
export function readCurrentWeek(now: Date, schedule: WeeklySchedule): WeeklyMoment | null {
  const start = Math.floor(now.getTime() / STEP_MS) * STEP_MS;
  for (let step = 0; step <= STEPS_IN_EIGHT_DAYS; step += 1) {
    const moment = new Date(start - step * STEP_MS);
    if (isScheduledMoment(moment, schedule)) return { weekKey: readLocalParts(moment, schedule.timeZone).date, at: moment };
  }
  return null;
}

export function readNextSend(now: Date, schedule: WeeklySchedule): WeeklyMoment | null {
  const start = Math.ceil(now.getTime() / STEP_MS) * STEP_MS;
  for (let step = 0; step <= STEPS_IN_EIGHT_DAYS; step += 1) {
    const moment = new Date(start + step * STEP_MS);
    if (isScheduledMoment(moment, schedule)) return { weekKey: readLocalParts(moment, schedule.timeZone).date, at: moment };
  }
  return null;
}

export function describeSchedule({ weekday, hour, timeZone }: WeeklySchedule) {
  return `${WEEKDAYS[weekday]}s at ${String(hour).padStart(2, "0")}:00, ${timeZone}`;
}
