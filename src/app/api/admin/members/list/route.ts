import { memberListBodySchema } from "@/modules/admin/contract";
import { readAdminMembers } from "@/modules/admin/reads-members";
import { adminRoutes } from "@/modules/admin/routes";

export const POST = adminRoutes.member(
  "admin-member-list",
  memberListBodySchema,
  async ({ database }, body) => Response.json(await readAdminMembers(database, body)),
  { adminOnly: true },
);
