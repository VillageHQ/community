import { inviteIdBodySchema } from "@/lib/invites/invite-api";
import { resendInvite } from "@/lib/invites/invites";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "invite-resend",
  inviteIdBodySchema,
  async (context, { inviteId }) => Response.json(await resendInvite(context, inviteId)),
  { adminOnly: true },
);
