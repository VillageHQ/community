import { inviteListBodySchema } from "@/lib/invites/invite-api";
import { readInvites } from "@/lib/invites/invites";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "invite-list",
  inviteListBodySchema,
  async ({ database }, { page, filter }) => Response.json(await readInvites(database, page, filter)),
  { adminOnly: true },
);
