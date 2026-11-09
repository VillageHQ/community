import "server-only";

import type { DatabaseOrTransaction } from "../../platform/database/client.ts";
import { askSkip } from "./schema-skip.ts";

// Saying "not for me" twice is the same as once.
export async function skipAsk(connection: DatabaseOrTransaction, memberId: string, askId: string) {
  await connection.insert(askSkip).values({ askId, memberId }).onConflictDoNothing();
  return { askId };
}
