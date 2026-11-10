import { linkSourceBodySchema } from "@/modules/job-board/contract";
import { jobBoardRoutes } from "@/modules/job-board/routes";
import { linkSource } from "@/modules/job-board/service";

export const POST = jobBoardRoutes.member("job-board-link", linkSourceBodySchema, async (context, body) => Response.json(await linkSource(context, body)));
