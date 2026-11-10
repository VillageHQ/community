import { hideSourceBodySchema } from "@/modules/job-board/contract";
import { jobBoardRoutes } from "@/modules/job-board/routes";
import { setSourceHidden } from "@/modules/job-board/service";

export const POST = jobBoardRoutes.member("job-board-hide", hideSourceBodySchema, async (context, body) => Response.json(await setSourceHidden(context, body)));
