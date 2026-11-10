import { jobBoardRoutes } from "@/modules/job-board/routes";
import { FRAME_SCRIPT, SCRIPT_HEADERS } from "@/modules/job-board/rules-widget";

export const GET = jobBoardRoutes.open("job-board-frame-script", async () => new Response(FRAME_SCRIPT, { headers: SCRIPT_HEADERS }));
