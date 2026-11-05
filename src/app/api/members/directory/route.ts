import { readDirectory } from "@/modules/members/reads-directory";
import { directoryFiltersSchema } from "@/modules/members/contract-profile";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("member-directory", directoryFiltersSchema, async ({ database }, filters) =>
  Response.json(await readDirectory(database, filters)),
);
