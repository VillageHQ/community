import { connectorAnswerBodySchema } from "@/modules/intros/contract";
import { introsRoutes } from "@/modules/intros/routes";
import { answerAsConnector } from "@/modules/intros/service-answers";

export const POST = introsRoutes.member("intros-connector-answer", connectorAnswerBodySchema, async (context, body) =>
  Response.json(await answerAsConnector(context, body)),
);
