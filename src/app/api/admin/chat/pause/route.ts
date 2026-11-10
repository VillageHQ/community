import { chatPauseBodySchema } from "@/modules/chat/contract";
import { chatRoutes } from "@/modules/chat/routes";
import { setChatPaused } from "@/modules/chat/service";

export const POST = chatRoutes.member(
  "admin-chat-pause",
  chatPauseBodySchema,
  async (context, { kind, isPaused }) => {
    await setChatPaused(context, kind, isPaused);
    return Response.json({ message: isPaused ? "Posting paused." : "Posting is back on. Asks from now on are posted." });
  },
  { adminOnly: true },
);
