import "server-only";

import { and, eq, inArray, isNotNull, isNull, lt, ne, notInArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { linkedinUrl as linkedinProfileUrl } from "@villagehq/sdk";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database, DatabaseOrTransaction } from "../../platform/database/client.ts";
import { isActiveMember } from "../../platform/auth/member-status.ts";
import { INSTANCE_SETTING_KEYS, instanceSettings } from "../../platform/settings/schema.ts";
import { saveSettings } from "../../platform/settings/store.ts";
import { memberFillIn, memberLookup, memberNetwork } from "./schema.ts";
import {
  FILL_IN_BASES,
  FILL_IN_FIELD_VALUES,
  FILL_IN_FIELDS,
  FILL_IN_REFRESH_DAYS,
  LOOKUP_STATUSES,
  type FillInBasis,
  type FillInBasisBody,
  type FillInField,
  type FilledLine,
  type LookupStatus,
} from "./contract-fill-in.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const BASIS_VALUES: readonly string[] = Object.values(FILL_IN_BASES);

export type FillInSettings = { basis: FillInBasis | null; termsDate: string | null };

function isFillInBasis(value: string | undefined): value is FillInBasis {
  return value !== undefined && BASIS_VALUES.includes(value);
}

export async function readFillInSettings(database: DatabaseOrTransaction): Promise<FillInSettings> {
  const rows = await database
    .select({ key: instanceSettings.key, value: instanceSettings.value })
    .from(instanceSettings)
    .where(inArray(instanceSettings.key, [INSTANCE_SETTING_KEYS.fillInBasis, INSTANCE_SETTING_KEYS.fillInTermsDate]));
  const settings = new Map(rows.map(({ key, value }) => [key, value]));
  const basis = settings.get(INSTANCE_SETTING_KEYS.fillInBasis);
  if (!isFillInBasis(basis)) return { basis: null, termsDate: null };
  return { basis, termsDate: basis === FILL_IN_BASES.terms ? (settings.get(INSTANCE_SETTING_KEYS.fillInTermsDate) ?? null) : null };
}

// Removes what public profiles said, for one member or everyone. A hidden line keeps only its hide,
// with no words, so it stays hidden if the member is ever filled in again.
async function removeFilledLines(transaction: DatabaseOrTransaction, memberId: string | null) {
  const ofMember = memberId ? eq(memberFillIn.userId, memberId) : undefined;
  await transaction.delete(memberFillIn).where(and(ofMember, isNull(memberFillIn.hiddenAt)));
  await transaction.update(memberFillIn).set({ value: "" }).where(and(ofMember, isNotNull(memberFillIn.hiddenAt)));
}

// Call inside the admin's audited transaction. Turning fill-in off also removes every filled-in
// line, so nothing from public profiles stays on a card without a basis to show it.
export async function saveFillInSettings(transaction: DatabaseOrTransaction, body: FillInBasisBody) {
  if (body.basis === "off") {
    await transaction
      .delete(instanceSettings)
      .where(inArray(instanceSettings.key, [INSTANCE_SETTING_KEYS.fillInBasis, INSTANCE_SETTING_KEYS.fillInTermsDate]));
    await removeFilledLines(transaction, null);
    return;
  }
  await saveSettings(transaction, {
    [INSTANCE_SETTING_KEYS.fillInBasis]: body.basis,
    [INSTANCE_SETTING_KEYS.fillInTermsDate]: body.basis === FILL_IN_BASES.terms ? body.termsDate : "",
  });
}

type LookupChoice = { consentedAt: Date | null; refusedAt: Date | null };

// The consent gate. No basis: nobody is looked up. "Don't look me up" always wins. With "ask each
// member", only a member who said yes. The SQL twin is lookupAllowedCondition.
export function isLookupAllowed(basis: FillInBasis | null, choice: LookupChoice | null | undefined) {
  if (!basis || choice?.refusedAt) return false;
  return basis === FILL_IN_BASES.terms || Boolean(choice?.consentedAt);
}

function lookupAllowedCondition(basis: FillInBasis | null) {
  if (!basis) return sql`false`;
  if (basis === FILL_IN_BASES.terms) return isNull(memberLookup.refusedAt);
  return and(isNull(memberLookup.refusedAt), sql`${memberLookup.consentedAt} is not null`);
}

export async function readLookupState(database: Database, memberId: string) {
  const [settings, [choice]] = await Promise.all([
    readFillInSettings(database),
    database.select().from(memberLookup).where(eq(memberLookup.userId, memberId)),
  ]);
  return {
    ...settings,
    consentedAt: choice?.consentedAt ?? null,
    refusedAt: choice?.refusedAt ?? null,
    status: (choice?.status ?? null) as LookupStatus | null,
    lookedUpAt: choice?.lookedUpAt ?? null,
    isAllowed: isLookupAllowed(settings.basis, choice),
    needsAnswer: settings.basis === FILL_IN_BASES.ask && !choice?.consentedAt && !choice?.refusedAt,
  };
}

export type LookupState = Awaited<ReturnType<typeof readLookupState>>;

// A no also removes every line already filled in, so nothing from public profiles stays on the card.
export async function saveLookupChoice(database: Database, memberId: string, allowsLookup: boolean) {
  const now = new Date();
  const choice = allowsLookup ? { consentedAt: now, refusedAt: null } : { consentedAt: null, refusedAt: now };
  await database.transaction(async (transaction) => {
    await transaction.insert(memberLookup).values({ userId: memberId, ...choice }).onConflictDoUpdate({ target: memberLookup.userId, set: choice });
    if (!allowsLookup) await removeFilledLines(transaction, memberId);
  });
}

// The first lookup goes by email. Every later one refreshes by LinkedIn when there is one to use.
export type DueLookup = { memberId: string; email: string; linkedinUrl: string | null };

// Members the nightly job should look up: allowed, active, and never looked up or not for 30 days.
export async function readDueLookups(database: Database, limit: number, now = new Date()): Promise<DueLookup[]> {
  const { basis } = await readFillInSettings(database);
  if (!basis) return [];
  const staleBefore = new Date(now.getTime() - FILL_IN_REFRESH_DAYS * DAY_MS);
  const rows = await database
    .select({
      memberId: user.id,
      email: user.email,
      foundLinkedinUrl: memberLookup.linkedinUrl,
      ownLinkedinSlug: memberNetwork.linkedinSlug,
      status: memberLookup.status,
    })
    .from(user)
    .leftJoin(memberLookup, eq(memberLookup.userId, user.id))
    .leftJoin(memberNetwork, eq(memberNetwork.userId, user.id))
    .where(and(isActiveMember(now), lookupAllowedCondition(basis), or(isNull(memberLookup.lookedUpAt), lt(memberLookup.lookedUpAt, staleBefore))))
    .orderBy(sql`${memberLookup.lookedUpAt} asc nulls first`, user.id)
    .limit(limit);
  return rows.map((row) => toDueLookup(row));
}

type LookupRow = { memberId: string; email: string; foundLinkedinUrl: string | null; ownLinkedinSlug: string | null; status: string | null };

function toDueLookup({ memberId, email, foundLinkedinUrl, ownLinkedinSlug, status }: LookupRow): DueLookup {
  // The member's own LinkedIn wins over the one the lookup found.
  const linkedinUrl = ownLinkedinSlug ? linkedinProfileUrl(ownLinkedinSlug) : foundLinkedinUrl;
  return { memberId, email, linkedinUrl: status === null ? null : linkedinUrl };
}

export async function readDueLookup(database: Database, memberId: string): Promise<DueLookup | null> {
  const [row] = await database
    .select({
      memberId: user.id,
      email: user.email,
      foundLinkedinUrl: memberLookup.linkedinUrl,
      ownLinkedinSlug: memberNetwork.linkedinSlug,
      status: memberLookup.status,
    })
    .from(user)
    .leftJoin(memberLookup, eq(memberLookup.userId, user.id))
    .leftJoin(memberNetwork, eq(memberNetwork.userId, user.id))
    .where(and(eq(user.id, memberId), isActiveMember()));
  return row ? toDueLookup(row) : null;
}

export async function isMemberLookupAllowed(database: DatabaseOrTransaction, memberId: string) {
  const [settings, [choice]] = await Promise.all([
    readFillInSettings(database),
    database.select().from(memberLookup).where(eq(memberLookup.userId, memberId)),
  ]);
  return isLookupAllowed(settings.basis, choice);
}

export type FilledProfile = Partial<Record<FillInField, string>>;

// Saves one lookup. The gate is checked again under the member's row lock, so a "Don't look me up"
// saved while Village was answering wins. A refresh replaces each value and its date but never
// hidden_at, so a hidden line stays hidden; a line the new profile lacks goes, unless it's hidden.
export async function saveFilledProfile(database: Database, memberId: string, profile: FilledProfile, linkedinUrl: string | null) {
  const now = new Date();
  return database.transaction(async (transaction) => {
    await transaction.insert(memberLookup).values({ userId: memberId }).onConflictDoNothing();
    const [choice] = await transaction.select().from(memberLookup).where(eq(memberLookup.userId, memberId)).for("update");
    const { basis } = await readFillInSettings(transaction);
    if (!isLookupAllowed(basis, choice)) return false;

    const lines = Object.entries(profile).flatMap(([field, value]) => (value ? [{ userId: memberId, field, value, filledAt: now }] : []));
    if (lines.length > 0) {
      await transaction
        .insert(memberFillIn)
        .values(lines)
        .onConflictDoUpdate({ target: [memberFillIn.userId, memberFillIn.field], set: { value: sql`excluded.value`, filledAt: sql`excluded.filled_at` } });
    }
    await transaction.delete(memberFillIn).where(
      and(
        eq(memberFillIn.userId, memberId),
        isNull(memberFillIn.hiddenAt),
        lines.length > 0 ? notInArray(memberFillIn.field, lines.map(({ field }) => field)) : undefined,
      ),
    );
    await transaction
      .update(memberLookup)
      .set({ status: LOOKUP_STATUSES.found, lookedUpAt: now, linkedinUrl: linkedinUrl ?? choice?.linkedinUrl ?? null })
      .where(eq(memberLookup.userId, memberId));
    return true;
  });
}

// Nobody found, or Village failed for this member. They wait 30 days like everyone else.
export async function recordLookupMiss(database: Database, memberId: string, status: Exclude<LookupStatus, "found">) {
  const now = new Date();
  await database
    .insert(memberLookup)
    .values({ userId: memberId, status, lookedUpAt: now })
    .onConflictDoUpdate({ target: memberLookup.userId, set: { status, lookedUpAt: now } });
}

export async function setFillInHidden(database: Database, memberId: string, field: FillInField, isHidden: boolean) {
  const updated = await database
    .update(memberFillIn)
    .set({ hiddenAt: isHidden ? new Date() : null })
    .where(and(eq(memberFillIn.userId, memberId), eq(memberFillIn.field, field)))
    .returning({ field: memberFillIn.field });
  return updated.length > 0;
}

export async function readFilledLines(database: Database, memberId: string): Promise<FilledLine[]> {
  const rows = await database.select().from(memberFillIn).where(and(eq(memberFillIn.userId, memberId), ne(memberFillIn.value, "")));
  const order = (field: string) => FILL_IN_FIELD_VALUES.indexOf(field as FillInField);
  return rows.toSorted((first, second) => order(first.field) - order(second.field)).map(({ field, value, filledAt, hiddenAt }) => ({ field: field as FillInField, value, filledAt: filledAt.toISOString(), isHidden: hiddenAt !== null }));
}

export type ShownFillIn = { value: string; filledAt: Date };

// The filled-in lines anyone may see: not hidden. The caller decides which of them the member's
// own words replace.
// The headline usually repeats the role and company, so hiding either one hides it too.
export async function readShownFillIn(database: Database, memberId: string) {
  const rows = await database
    .select({ field: memberFillIn.field, value: memberFillIn.value, filledAt: memberFillIn.filledAt, hiddenAt: memberFillIn.hiddenAt })
    .from(memberFillIn)
    .where(and(eq(memberFillIn.userId, memberId), ne(memberFillIn.value, "")));
  const hidesHeadline = rows.some(({ field, hiddenAt }) => hiddenAt !== null && (field === FILL_IN_FIELDS.title || field === FILL_IN_FIELDS.company));
  const shown = rows.filter(({ field, hiddenAt }) => hiddenAt === null && !(hidesHeadline && field === FILL_IN_FIELDS.headline));
  return new Map(shown.map(({ field, value, filledAt }) => [field as FillInField, { value, filledAt }]));
}

// For lists: one shown line per member, joined in SQL.
export function shownFillInColumn(field: FillInField) {
  const line = alias(memberFillIn, `fill_in_${field}`);
  return {
    line,
    joinCondition: and(eq(line.userId, user.id), eq(line.field, field), isNull(line.hiddenAt)),
  };
}

export { FILL_IN_FIELDS };

// For the Credits page: how many active members have at least one filled-in line.
export async function readFilledMemberCount(database: Database) {
  const [row] = await database
    .select({ memberCount: sql<number>`count(distinct ${memberFillIn.userId})`.mapWith(Number) })
    .from(memberFillIn)
    .innerJoin(user, eq(user.id, memberFillIn.userId))
    .where(isActiveMember());
  return row?.memberCount ?? 0;
}
