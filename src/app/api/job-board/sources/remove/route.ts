import { sourceBodySchema } from "@/modules/job-board/contract";
import { jobBoardRoutes } from "@/modules/job-board/routes";
import { removeSource } from "@/modules/job-board/service";

export const POST = jobBoardRoutes.member("job-board-remove", sourceBodySchema, async (context, { sourceId }) => Response.json(await removeSource(context, sourceId)));
