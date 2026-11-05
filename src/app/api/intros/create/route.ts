import { createIntroRequest } from "@/modules/intros/service";
import { createIntroBodySchema } from "@/modules/intros/contract";
import { introsRoutes } from "@/modules/intros/routes";

export const POST = introsRoutes.member("intros-create", createIntroBodySchema, async (context, body) =>
  Response.json(await createIntroRequest(context, body)),
);
