import { createInviteBodySchema } from "@/modules/members/contract-invites";
import { createInvite } from "@/modules/members/service-invites";
import { membersRoutes } from "@/modules/members/routes";

const CREATED_STATUS = 201;

export const POST = membersRoutes.member(
  "invite-create",
  createInviteBodySchema,
  async (context, { email, cohort }) => Response.json(await createInvite(context, email, cohort), { status: CREATED_STATUS }),
  { adminOnly: true },
);
