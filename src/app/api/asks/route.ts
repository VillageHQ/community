import { askBoardBodySchema } from "@/modules/asks/contract";
import { readAskBoard } from "@/modules/asks/reads";
import { asksRoutes } from "@/modules/asks/routes";
import { isAskIntroOn } from "@/shell/ask-helpers";

export const POST = asksRoutes.member("asks-board", askBoardBodySchema, async ({ database, member }, { category, kind, cursor }) =>
  Response.json(await readAskBoard(database, { viewerId: member.id, category, kind, cursor, canIntro: await isAskIntroOn(database) })),
);
