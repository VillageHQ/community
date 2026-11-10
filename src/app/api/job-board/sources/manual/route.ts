import { manualSourceBodySchema } from "@/modules/job-board/contract";
import { jobBoardRoutes } from "@/modules/job-board/routes";
import { createManualSource } from "@/modules/job-board/service";

export const POST = jobBoardRoutes.member("job-board-manual", manualSourceBodySchema, async (context, body) => Response.json(await createManualSource(context, body)));
