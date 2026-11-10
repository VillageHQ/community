import { sourceBodySchema } from "@/modules/job-board/contract";
import { jobBoardRoutes } from "@/modules/job-board/routes";
import { pullSourceNow } from "@/modules/job-board/service";

export const POST = jobBoardRoutes.member("job-board-pull", sourceBodySchema, async (context, { sourceId }) => Response.json(await pullSourceNow(context, sourceId)));
