import "server-only";

import { MODULES } from "@/modules/registry";
import type { Transaction } from "@/platform/database/client";
import type { MemberRemoval } from "@/platform/modules/integration";

export async function runMemberBlockedEffects(transaction: Transaction, blockerId: string, blockedId: string) {
  for (const { onMemberBlocked } of MODULES) await onMemberBlocked?.(transaction, blockerId, blockedId);
}

export async function runMemberRemovedEffects(transaction: Transaction, removal: MemberRemoval) {
  for (const { onMemberRemoved } of MODULES) await onMemberRemoved?.(transaction, removal);
}
