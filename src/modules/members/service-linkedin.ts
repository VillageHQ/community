import "server-only";

import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { memberNetwork } from "./schema.ts";
import { readLinkedinSlug, MEMBER_ERROR_CODES } from "./contract-linkedin.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import type { SessionMember, RequestContext } from "../../platform/http/request-context.ts";

const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;

export async function ensureMemberNetwork(database: Database, userId: string) {
  await database.insert(memberNetwork).values({ userId }).onConflictDoNothing();
  const [network] = await database
    .select()
    .from(memberNetwork)
    .where(eq(memberNetwork.userId, userId));
  if (!network) throw new Error("The member network row is missing.");
  return network;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function isMemberEmailTrusted(database: Database, member: SessionMember) {
  const [row] = await database
    .select({ emailVerified: user.emailVerified, approvedMemberEmail: memberNetwork.approvedMemberEmail })
    .from(user)
    .leftJoin(memberNetwork, eq(memberNetwork.userId, user.id))
    .where(eq(user.id, member.id));
  if (!row) return false;
  return row.emailVerified || row.approvedMemberEmail === normalizeEmail(member.email);
}

const UNIQUE_VIOLATION_CODE = "23505";

const uniqueViolationSchema = z.object({ code: z.literal(UNIQUE_VIOLATION_CODE) });

function isUniqueViolation(error: unknown) {
  return error instanceof Error && uniqueViolationSchema.safeParse(error.cause).success;
}

function linkedinTakenError() {
  return new RequestError(
    CONFLICT_STATUS,
    MEMBER_ERROR_CODES.linkedinTaken,
    "Another member already uses this LinkedIn profile. Ask an admin to clear it from Admin, then Members.",
  );
}

export async function readIsLinkedinConfirmed(database: Database, memberId: string) {
  const [network] = await database
    .select({ linkedinSlug: memberNetwork.linkedinSlug, linkedinConfirmedSlug: memberNetwork.linkedinConfirmedSlug })
    .from(memberNetwork)
    .where(eq(memberNetwork.userId, memberId));
  return Boolean(network?.linkedinSlug) && network?.linkedinSlug === network?.linkedinConfirmedSlug;
}

export async function saveMemberLinkedinUrl(
  { database, member }: RequestContext,
  linkedinUrl: string,
) {
  const linkedinSlug = readLinkedinSlug(linkedinUrl);
  if (!linkedinSlug) {
    throw new RequestError(
      UNPROCESSABLE_STATUS,
      MEMBER_ERROR_CODES.linkedinInvalid,
      "Enter your LinkedIn profile URL, like https://www.linkedin.com/in/your-name.",
    );
  }

  await ensureMemberNetwork(database, member.id);

  const [claimedByAnotherMember] = await database
    .select({ userId: memberNetwork.userId })
    .from(memberNetwork)
    .where(and(eq(memberNetwork.linkedinSlug, linkedinSlug), ne(memberNetwork.userId, member.id)));
  if (claimedByAnotherMember) throw linkedinTakenError();

  await database
    .update(memberNetwork)
    .set({ linkedinSlug })
    .where(eq(memberNetwork.userId, member.id))
    .catch((error: unknown) => {
      throw isUniqueViolation(error) ? linkedinTakenError() : error;
    });
}
