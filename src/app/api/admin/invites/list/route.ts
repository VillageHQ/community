import { inviteListBodySchema } from "@/lib/invites/invite-api";
import { readInvites } from "@/lib/invites/invites";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute(
  "invite-list",
  inviteListBodySchema,
  async ({ database }, { page, filter }) => Response.json(await readInvites(database, page, filter)),
  { adminOnly: true },
);
