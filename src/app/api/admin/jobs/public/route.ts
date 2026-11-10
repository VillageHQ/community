import { publicSwitchBodySchema } from "@/modules/job-board/contract";
import { jobBoardRoutes } from "@/modules/job-board/routes";
import { setPublicBoard } from "@/modules/job-board/service";

export const POST = jobBoardRoutes.member("admin-job-board-public", publicSwitchBodySchema, async (context, { isPublic }) => Response.json(await setPublicBoard(context, isPublic)), {
  adminOnly: true,
});
