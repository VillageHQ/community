import { readDirectory } from "@/lib/members/directory";
import { directoryFiltersSchema } from "@/lib/members/profile-api";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("member-directory", directoryFiltersSchema, async ({ database }, filters) =>
  Response.json(await readDirectory(database, filters)),
);
