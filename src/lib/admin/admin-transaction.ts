import "server-only";

import { eq } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database, Transaction } from "../../platform/database/client.ts";
import { isBanActive } from "../members/active-member.ts";
import { NetworkRequestError } from "../village/member-network.ts";
import { NETWORK_ERROR_CODES } from "../village/network-api.ts";
import { MEMBER_ROLES } from "./admin-api.ts";

const FORBIDDEN_STATUS = 403;

// FOR SHARE makes a removal or demotion of this admin wait for the action in flight, so neither can overtake the other.
export async function requireCurrentAdmin(transaction: Transaction, actorId: string) {
  const [actor] = await transaction
    .select({ role: user.role, banned: user.banned, banExpires: user.banExpires })
    .from(user)
    .where(eq(user.id, actorId))
    .for("share");
  if (actor && actor.role === MEMBER_ROLES.admin && !isBanActive(actor)) return;
  throw new NetworkRequestError(
    FORBIDDEN_STATUS,
    NETWORK_ERROR_CODES.forbidden,
    "You aren't an admin anymore, so nothing changed. Another admin may have just changed your role.",
  );
}

export function withAdminTransaction<Result>(database: Database, actorId: string, work: (transaction: Transaction) => Promise<Result>) {
  return database.transaction(async (transaction) => {
    await requireCurrentAdmin(transaction, actorId);
    return work(transaction);
  });
}
