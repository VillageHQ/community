import { ASK_LIMITS, ASK_STATES } from "./contract.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const LIFETIME_MS = ASK_LIMITS.lifetimeDays * DAY_MS;
const RENEWAL_WINDOW_MS = ASK_LIMITS.renewableWithinDays * DAY_MS;

type AskTimes = { listedAt: Date; closedAt: Date | null };

export function readExpiresAt(listedAt: Date) {
  return new Date(listedAt.getTime() + LIFETIME_MS);
}

export function readOldestOpenListing(now: Date) {
  return new Date(now.getTime() - LIFETIME_MS);
}

export function readAskState({ listedAt, closedAt }: AskTimes, now: Date) {
  if (closedAt) return ASK_STATES.closed;
  return listedAt > readOldestOpenListing(now) ? ASK_STATES.open : ASK_STATES.expired;
}

export function canRenewAsk(times: AskTimes, now: Date) {
  if (times.closedAt) return false;
  return readExpiresAt(times.listedAt).getTime() - now.getTime() <= RENEWAL_WINDOW_MS;
}
