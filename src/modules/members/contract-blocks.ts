import { z } from "zod";

import { readFirstName } from "../../platform/design/avatar-identity.ts";
import { removeNullBytes } from "../../platform/text/safe-text.ts";

const MAXIMUM_MEMBER_ID_LENGTH = 256;

export const BLOCK_ERROR_CODES = {
  notFound: "message_not_found",
  ownAccount: "message_own_conversation",
} as const;

export const memberIdSchema = z
  .string()
  .overwrite(removeNullBytes)
  .min(1)
  .max(MAXIMUM_MEMBER_ID_LENGTH);

export const setBlockBodySchema = z.object({ memberId: memberIdSchema, isBlocked: z.boolean() });

export const blockStateSchema = z.object({ isBlocked: z.boolean() });

export type SetBlockBody = z.infer<typeof setBlockBodySchema>;

export function describeBlock(memberName: string) {
  const firstName = readFirstName(memberName);
  return `${firstName} won't be told. Nothing ${firstName} sends from now on will reach you, including intro asks. You can unblock any time.`;
}
