import { addJobBodySchema } from "@/modules/job-board/contract";
import { jobBoardRoutes } from "@/modules/job-board/routes";
import { addManualJob } from "@/modules/job-board/service";

export const POST = jobBoardRoutes.member("job-board-add-job", addJobBodySchema, async (context, body) => Response.json(await addManualJob(context, body)));
