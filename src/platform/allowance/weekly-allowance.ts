import type { DatabaseOrTransaction } from "../database/client.ts";

// The one weekly allowance (asks a member posts and intro asks they send) spans two modules, so neither can read it
// alone. The shell provides the reader once at boot (`src/instrumentation.ts`); a module that only needs to say it
// ("you have 4 of 5 asks left this week") asks here. Kept on globalThis because Next.js bundles boot code and routes
// separately.
export type WeeklyAllowance = { left: number; cap: number };

type AllowanceReader = (connection: DatabaseOrTransaction, memberId: string) => Promise<WeeklyAllowance>;

const READER_KEY = Symbol.for("community.weekly-allowance-reader");

type ReaderHolder = { [READER_KEY]?: AllowanceReader };

export function provideWeeklyAllowance(reader: AllowanceReader) {
  (globalThis as ReaderHolder)[READER_KEY] = reader;
}

// Null when nothing provided a reader (a script, a test that doesn't need it).
export async function readWeeklyAllowanceFor(connection: DatabaseOrTransaction, memberId: string) {
  const reader = (globalThis as ReaderHolder)[READER_KEY];
  return reader ? reader(connection, memberId) : null;
}

export function describeAllowanceLeft({ left, cap }: WeeklyAllowance) {
  return `${left} of ${cap} asks left this week`;
}
