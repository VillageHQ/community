import { inviteListBodySchema } from "@/modules/members/contract-invites";
import { readInvites } from "@/modules/members/service-invites";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "invite-list",
  inviteListBodySchema,
  async ({ database }, { page, filter }) => Response.json(await readInvites(database, page, filter)),
  { adminOnly: true },
);
