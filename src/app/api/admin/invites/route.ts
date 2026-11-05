import { createInviteBodySchema } from "@/modules/members/contract-invites";
import { createInvite } from "@/modules/members/service-invites";
import { createMemberRoute } from "@/platform/village/member-routes";

const CREATED_STATUS = 201;

export const POST = createMemberRoute(
  "invite-create",
  createInviteBodySchema,
  async (context, { email }) => Response.json(await createInvite(context, email), { status: CREATED_STATUS }),
  { adminOnly: true },
);
