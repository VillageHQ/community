import { createIntroRequest } from "@/modules/intros/service";
import { createIntroBodySchema } from "@/modules/intros/contract";
import { introsRoutes } from "@/modules/intros/routes";
import { assertAskAllowance } from "@/shell/ask-helpers";
import { readIntroNetwork } from "@/shell/intro-network";

export const POST = introsRoutes.member("intros-create", createIntroBodySchema, async (context, body) =>
  Response.json(await createIntroRequest(context, body, { assertAllowance: assertAskAllowance, network: await readIntroNetwork(context.database) })),
);
