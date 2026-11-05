import { memberListBodySchema } from "@/modules/admin/contract";
import { readAdminMembers } from "@/modules/admin/reads-members";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "admin-member-list",
  memberListBodySchema,
  async ({ database }, body) => Response.json(await readAdminMembers(database, body)),
  { adminOnly: true },
);
