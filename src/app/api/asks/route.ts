import { askBoardBodySchema } from "@/modules/asks/contract";
import { readAskBoard } from "@/modules/asks/reads";
import { asksRoutes } from "@/modules/asks/routes";
import { isAdminMember } from "@/platform/auth/roles";
import { isAskIntroOn } from "@/shell/ask-helpers";

export const POST = asksRoutes.member("asks-board", askBoardBodySchema, async ({ database, member }, body) =>
  Response.json(await readAskBoard(database, { viewerId: member.id, isViewerAdmin: isAdminMember(member), ...body, canIntro: await isAskIntroOn(database) })),
);
