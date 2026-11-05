import { memberListBodySchema } from "@/lib/admin/admin-api";
import { readAdminMembers } from "@/lib/admin/member-list";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute(
  "admin-member-list",
  memberListBodySchema,
  async ({ database }, body) => Response.json(await readAdminMembers(database, body)),
  { adminOnly: true },
);
