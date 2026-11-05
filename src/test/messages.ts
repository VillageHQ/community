import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type { Database } from "../platform/database/client.ts";
import { conversation, directMessage } from "../database/messages-schema.ts";
import { toConversationPair } from "../lib/messages/conversation-pair.ts";

export async function seedConversation(database: Database, firstMemberId: string, secondMemberId: string) {
  const [seeded] = await database
    .insert(conversation)
    .values(toConversationPair(firstMemberId, secondMemberId))
    .returning({ id: conversation.id });
  if (!seeded) throw new Error("The seeded conversation is missing.");
  return seeded.id;
}

type MessageSeed = { conversationId: string; senderId: string; count: number; createdAt?: Date };

export async function seedMessages(database: Database, { conversationId, senderId, count, createdAt }: MessageSeed) {
  const [target] = await database
    .select({ lastRevision: conversation.lastRevision })
    .from(conversation)
    .where(eq(conversation.id, conversationId));
  const firstRevision = (target?.lastRevision ?? 0) + 1;
  const rows = Array.from({ length: count }, (_unused, position) => ({
    conversationId,
    senderId,
    clientKey: randomUUID(),
    body: `Seeded message ${firstRevision + position}`,
    sequence: firstRevision + position,
    revision: firstRevision + position,
    createdAt,
  }));
  await database.insert(directMessage).values(rows);
  await database
    .update(conversation)
    .set({ lastRevision: firstRevision + count - 1 })
    .where(eq(conversation.id, conversationId));
  return rows.map(({ sequence }) => sequence);
}
