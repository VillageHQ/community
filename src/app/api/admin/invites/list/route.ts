import { inviteListBodySchema } from "@/modules/members/contract-invites";
import { readInvites } from "@/modules/members/service-invites";
import { membersRoutes } from "@/modules/members/routes";

export const POST = membersRoutes.member(
  "invite-list",
  inviteListBodySchema,
  async ({ database }, { page, filter }) => Response.json(await readInvites(database, page, filter)),
  { adminOnly: true },
);
