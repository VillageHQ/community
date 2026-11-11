import { chatKindBodySchema } from "@/modules/chat/contract";
import { chatRoutes } from "@/modules/chat/routes";
import { disconnectChat } from "@/modules/chat/service";

export const POST = chatRoutes.member(
  "admin-chat-disconnect",
  chatKindBodySchema,
  async (context, { kind }) => {
    await disconnectChat(context, kind);
    return Response.json({ message: "Disconnected. The token is deleted from this server." });
  },
  { adminOnly: true },
);
