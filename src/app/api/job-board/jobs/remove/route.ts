import { removeJobBodySchema } from "@/modules/job-board/contract";
import { jobBoardRoutes } from "@/modules/job-board/routes";
import { removeManualJob } from "@/modules/job-board/service";

export const POST = jobBoardRoutes.member("job-board-remove-job", removeJobBodySchema, async (context, body) => Response.json(await removeManualJob(context, body)));
