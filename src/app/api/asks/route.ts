import { askBoardBodySchema } from "@/modules/asks/contract";
import { readAskBoard } from "@/modules/asks/reads";
import { asksRoutes } from "@/modules/asks/routes";

export const POST = asksRoutes.member("asks-board", askBoardBodySchema, async ({ database, member }, { category, cursor }) =>
  Response.json(await readAskBoard(database, { viewerId: member.id, category, cursor })),
);
