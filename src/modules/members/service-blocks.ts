import "server-only";

import { and, eq } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database, Transaction } from "../../platform/database/client.ts";
import type { NetworkContext } from "../../platform/http/request-context.ts";
import { NetworkRequestError } from "../../platform/http/request-error.ts";
import { BLOCK_ERROR_CODES, type SetBlockBody } from "./contract-blocks.ts";
import { memberBlock } from "./schema.ts";

const NOT_FOUND_STATUS = 404;
const UNPROCESSABLE_STATUS = 422;

type BlockEffect = (transaction: Transaction, blockerId: string, blockedId: string) => Promise<void>;

export async function isBlockedBy(database: Database, blockerId: string, blockedId: string) {
  const [block] = await database
    .select({ blockerId: memberBlock.blockerId })
    .from(memberBlock)
    .where(and(eq(memberBlock.blockerId, blockerId), eq(memberBlock.blockedId, blockedId)));
  return block !== undefined;
}

export async function setMemberBlocked({ database, member }: NetworkContext, { memberId, isBlocked }: SetBlockBody, onBlocked: BlockEffect) {
  if (memberId === member.id) {
    throw new NetworkRequestError(UNPROCESSABLE_STATUS, BLOCK_ERROR_CODES.ownAccount, "You can't block yourself.");
  }
  if (!isBlocked) {
    await database.delete(memberBlock).where(and(eq(memberBlock.blockerId, member.id), eq(memberBlock.blockedId, memberId)));
    return { isBlocked };
  }

  const [target] = await database.select({ id: user.id }).from(user).where(eq(user.id, memberId));
  if (!target) throw new NetworkRequestError(NOT_FOUND_STATUS, BLOCK_ERROR_CODES.notFound, "This member isn't available.");
  await database.transaction(async (transaction) => {
    await transaction.insert(memberBlock).values({ blockerId: member.id, blockedId: memberId }).onConflictDoNothing();
    await onBlocked(transaction, member.id, memberId);
  });
  return { isBlocked };
}
