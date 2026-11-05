import { readOwnAsks } from "@/modules/asks/reads";
import { asksRoutes } from "@/modules/asks/routes";
import { emptyBodySchema } from "@/platform/http/contract";

export const POST = asksRoutes.member("asks-own", emptyBodySchema, async ({ database, member }) => Response.json(await readOwnAsks(database, member.id)));
