import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { contentReport } from "../../database/admin-schema.ts";
import { user } from "../../database/auth-schema.ts";
import type { Transaction } from "../../database/client.ts";
import { messageReport } from "../../database/messages-schema.ts";
import type { ReportResolution } from "./admin-api.ts";

export async function readResolvedFields(transaction: Transaction, actorId: string, resolution: ReportResolution) {
  const [actor] = await transaction.select({ name: user.name }).from(user).where(eq(user.id, actorId));
  return { resolution, resolvedAt: new Date(), resolvedByUserId: actorId, resolvedByName: actor?.name ?? "" };
}

export async function resolveOpenReportsAgainstMember(transaction: Transaction, memberId: string, actorId: string, resolution: ReportResolution) {
  const resolved = await readResolvedFields(transaction, actorId, resolution);
  await transaction
    .update(messageReport)
    .set(resolved)
    .where(and(eq(messageReport.reportedMemberId, memberId), isNull(messageReport.resolvedAt)));
  await transaction
    .update(contentReport)
    .set(resolved)
    .where(and(eq(contentReport.reportedMemberId, memberId), isNull(contentReport.resolvedAt)));
}
