import "server-only";

import { isVillageError } from "@villagehq/sdk";
import { and, asc, eq } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import type { Environment } from "../../platform/environment.ts";
import { isActiveMember } from "../../platform/auth/member-status.ts";
import { MEMBER_ROLES } from "../../platform/auth/roles.ts";
import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { withAdminTransaction } from "../../platform/audit/admin-transaction.ts";
import { recordAdminAction } from "../../platform/audit/record.ts";
import type { RequestContext } from "../../platform/http/request-context.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import { logError } from "../../platform/observability/route-logging.ts";
import { recordFailedAttempt } from "../../platform/rate-limit/attempt-rate-limit.ts";
import { JOB_OUTCOMES, runJob } from "../../platform/jobs/runner.ts";
import { INSTANCE_SETTING_KEYS } from "../../platform/settings/schema.ts";
import { readSettings } from "../../platform/settings/store.ts";
import {
  createVillageLookupSession,
  isVillageErrorResponse,
  readVillageProfile,
  readVillageProfileByEmail,
  type VillageProfile,
} from "../../platform/village/client.ts";
import { CREDIT_CALL_KINDS } from "../../platform/village/contract.ts";
import { MonthlyCapReachedError, withCreditCall } from "../../platform/village/credit-ledger.ts";
import { recordVillageOutOfCredits, readVillageKeys } from "../../platform/village/settings.ts";
import { resolveVillageApiUrl } from "../../platform/village/urls.ts";
import { LOOKUP_STATUSES, type FillInBasisBody } from "../members/contract-fill-in.ts";
import {
  isMemberLookupAllowed,
  readLookupState,
  readDueLookup,
  readDueLookups,
  recordLookupMiss,
  saveFillInSettings,
  saveFilledProfile,
  type DueLookup,
} from "../members/service-fill-in.ts";
import { NETWORK_ERROR_CODES } from "./contract.ts";
import { toFilledProfile } from "./rules-fill-in.ts";

const LOOKUP_DEADLINE_MS = 30_000;
const NIGHTLY_BATCH_SIZE = 200;
// Shorter than the job's lease, so a slow Village can't make two runs overlap.
export const FILL_IN_RUN_BUDGET_MS = 20 * 60_000;
const CONFLICT_STATUS = 409;
const TOO_MANY_REQUESTS_STATUS = 429;
const FILL_IN_NOW_INTERVAL_MS = 60 * 60_000;
const SERVICE_UNAVAILABLE_STATUS = 503;

export const FILL_IN_OUTCOMES = { found: "found", notFound: "not_found", notAllowed: "not_allowed" } as const;

export type FillInOutcome = (typeof FILL_IN_OUTCOMES)[keyof typeof FILL_IN_OUTCOMES];

// The address Village sees for the app's lookup identity: the community's first admin.
async function readLookupEmail(database: Database) {
  const settings = await readSettings(database, [INSTANCE_SETTING_KEYS.firstAdminUserId]);
  const firstAdminId = settings.get(INSTANCE_SETTING_KEYS.firstAdminUserId);
  const [admin] = await database
    .select({ email: user.email })
    .from(user)
    .where(and(firstAdminId ? eq(user.id, firstAdminId) : eq(user.role, MEMBER_ROLES.admin), isActiveMember()))
    .orderBy(asc(user.createdAt))
    .limit(1);
  return admin?.email ?? null;
}

type LookupSetup = { database: Database; environment: Environment; session: ReturnType<typeof createVillageLookupSession> };

async function prepareLookups(database: Database, environment: Environment): Promise<LookupSetup | null> {
  const [keys, email] = await Promise.all([readVillageKeys(database, environment), readLookupEmail(database)]);
  if (!keys || !email) return null;
  const connection = { apiUrl: resolveVillageApiUrl(environment), secretKey: keys.secretKey, deadlineAtMs: Date.now() + LOOKUP_DEADLINE_MS };
  return { database, environment, session: createVillageLookupSession(connection, email) };
}

function isFound(profile: VillageProfile | null) {
  return profile !== null;
}

// One member. Their email first; later, a refresh by LinkedIn. Nothing is sent to Village unless the
// gate allows it, and the gate is checked again before anything is saved.
async function fillInOne(setup: LookupSetup, due: DueLookup, payingMemberId: string | null): Promise<FillInOutcome> {
  const { database, environment } = setup;
  if (!(await isMemberLookupAllowed(database, due.memberId))) return FILL_IN_OUTCOMES.notAllowed;

  const session = { ...setup.session, deadlineAtMs: Date.now() + LOOKUP_DEADLINE_MS };
  const profile = await withCreditCall(
    { database, environment, memberId: payingMemberId },
    CREDIT_CALL_KINDS.fillIn,
    () => (due.linkedinUrl ? readVillageProfile(session, due.linkedinUrl) : readVillageProfileByEmail(session, due.email)),
    isFound,
  );
  if (!profile) {
    await recordLookupMiss(database, due.memberId, LOOKUP_STATUSES.notFound);
    return FILL_IN_OUTCOMES.notFound;
  }
  const isSaved = await saveFilledProfile(database, due.memberId, toFilledProfile(profile), profile.linkedin_url ?? null);
  return isSaved ? FILL_IN_OUTCOMES.found : FILL_IN_OUTCOMES.notAllowed;
}

function notAllowedError() {
  return new RequestError(CONFLICT_STATUS, NETWORK_ERROR_CODES.fillInOff, "Filling in from public profiles isn't on for you. Check the choice on your card.");
}

function tooSoonError() {
  return new RequestError(TOO_MANY_REQUESTS_STATUS, NETWORK_ERROR_CODES.fillInTooSoon, "Your card was filled in less than an hour ago. Try again later.");
}

// The member's "Fill in now" button. At most once an hour, and one click at a time.
export async function fillInMemberNow({ database, environment, member }: RequestContext) {
  if (!(await isMemberLookupAllowed(database, member.id))) throw notAllowedError();
  const { lookedUpAt } = await readLookupState(database, member.id);
  if (lookedUpAt && Date.now() - lookedUpAt.getTime() < FILL_IN_NOW_INTERVAL_MS) throw tooSoonError();
  if ((await recordFailedAttempt(database, `fill-in-now|${member.id}`, 1)).isLimited) throw tooSoonError();
  const setup = await prepareLookups(database, environment);
  if (!setup) {
    throw new RequestError(SERVICE_UNAVAILABLE_STATUS, NETWORK_ERROR_CODES.notConfigured, "An admin needs to connect Village first.");
  }
  const due = await readDueLookup(database, member.id);
  if (!due) throw notAllowedError();
  try {
    return await fillInOne(setup, due, member.id);
  } catch (error) {
    if (isVillageError(error, "out_of_credits")) await recordVillageOutOfCredits(database);
    throw error;
  }
}

export type FillInRun = {
  checked: number;
  found: number;
  notFound: number;
  failed: number;
  stoppedBy: "monthly_cap" | "out_of_credits" | "village_unreachable" | "time_budget" | null;
};

// The nightly job, also run by the admin's "Fill in everyone now". It stops at the monthly cap and
// when Village is out of credits; one member's failure doesn't stop the others.
export async function runFillIn(database: Database, environment: Environment): Promise<FillInRun> {
  const run: FillInRun = { checked: 0, found: 0, notFound: 0, failed: 0, stoppedBy: null };
  const dueLookups = await readDueLookups(database, NIGHTLY_BATCH_SIZE);
  if (dueLookups.length === 0) return run;
  const setup = await prepareLookups(database, environment);
  if (!setup) return run;

  const stopAtMs = Date.now() + FILL_IN_RUN_BUDGET_MS;
  for (const due of dueLookups) {
    if (Date.now() >= stopAtMs) {
      run.stoppedBy = "time_budget";
      break;
    }
    try {
      const outcome = await fillInOne(setup, due, null);
      if (outcome === FILL_IN_OUTCOMES.notAllowed) continue;
      run.checked += 1;
      if (outcome === FILL_IN_OUTCOMES.found) run.found += 1;
      else run.notFound += 1;
    } catch (error) {
      if (error instanceof MonthlyCapReachedError) {
        run.stoppedBy = "monthly_cap";
        break;
      }
      if (isVillageError(error, "out_of_credits")) {
        await recordVillageOutOfCredits(database);
        run.stoppedBy = "out_of_credits";
        break;
      }
      logError("village-fill-in", error);
      // No answer at all means Village is down or slow: stop, and everyone waits for the next run.
      if (!isVillageErrorResponse(error)) {
        run.stoppedBy = "village_unreachable";
        break;
      }
      run.checked += 1;
      run.failed += 1;
      await recordLookupMiss(database, due.memberId, LOOKUP_STATUSES.failed);
    }
  }
  return run;
}

export function saveFillInBasis({ database, member }: RequestContext, body: FillInBasisBody) {
  return withAdminTransaction(database, member.id, async (transaction) => {
    await saveFillInSettings(transaction, body);
    const detail = body.basis === "terms" ? `terms:${body.termsDate}` : body.basis;
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.fillInBasisChanged, detail });
  });
}

export const FILL_IN_JOB_NAME = "profile-fill-in";
export const FILL_IN_LEASE_MS = 30 * 60_000;

// The admin's "Fill in everyone now": the nightly run, at once. It takes the nightly job's lease, so
// it never overlaps that job or a second click, and never looks up anyone the gate refuses.
export async function runFillInNow({ database, environment, member }: RequestContext) {
  await withAdminTransaction(database, member.id, (transaction) => recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.fillInRunStarted }));
  const finished: { run: FillInRun | null } = { run: null };
  const outcome = await runJob(database, environment, {
    name: FILL_IN_JOB_NAME,
    intervalMs: 0,
    leaseMs: FILL_IN_LEASE_MS,
    run: async (jobDatabase, jobEnvironment) => {
      finished.run = await runFillIn(jobDatabase, jobEnvironment);
    },
  });
  if (outcome === JOB_OUTCOMES.busy || outcome === JOB_OUTCOMES.notDue) {
    throw new RequestError(CONFLICT_STATUS, NETWORK_ERROR_CODES.fillInRunning, "Profiles are being filled in right now. Check back in a few minutes.");
  }
  if (!finished.run) throw new Error("The fill-in run failed. It's in the server log.");
  return finished.run;
}
