import { createInviteBodySchema } from "@/lib/invites/invite-api";
import { createInvite } from "@/lib/invites/invites";
import { createMemberRoute } from "@/platform/village/member-routes";

const CREATED_STATUS = 201;

export const POST = createMemberRoute(
  "invite-create",
  createInviteBodySchema,
  async (context, { email }) => Response.json(await createInvite(context, email), { status: CREATED_STATUS }),
  { adminOnly: true },
);
