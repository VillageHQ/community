import { inviteIdBodySchema } from "@/modules/members/contract-invites";
import { resendInvite } from "@/modules/members/service-invites";
import { membersRoutes } from "@/modules/members/routes";

// Set up › Sign-in links: a new link for one open invite, for the admin to send by hand. Only the token's hash is
// kept, so copying makes a new one; nothing is emailed.
export const POST = membersRoutes.member(
  "invite-copy-link",
  inviteIdBodySchema,
  async (context, { inviteId }) => Response.json(await resendInvite(context, inviteId, { sendEmail: false })),
  { adminOnly: true },
);
