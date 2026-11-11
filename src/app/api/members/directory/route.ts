import { readDirectory } from "@/modules/members/reads-directory";
import { directoryFiltersSchema } from "@/modules/members/contract-profile";
import { membersRoutes } from "@/modules/members/routes";
import { readHiringLookup } from "@/shell/directory-hiring";

export const POST = membersRoutes.member("member-directory", directoryFiltersSchema, async ({ database }, filters) =>
  Response.json(await readDirectory(database, filters, new Date(), await readHiringLookup(database))),
);
