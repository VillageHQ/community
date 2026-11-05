import { readDirectory } from "@/lib/members/directory";
import { directoryFiltersSchema } from "@/lib/members/profile-api";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute("member-directory", directoryFiltersSchema, async ({ database }, filters) =>
  Response.json(await readDirectory(database, filters)),
);
