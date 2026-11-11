import { discordConnectBodySchema } from "@/modules/chat/contract";
import { chatRoutes } from "@/modules/chat/routes";
import { connectDiscord } from "@/modules/chat/service";

export const POST = chatRoutes.member(
  "admin-chat-discord-connect",
  discordConnectBodySchema,
  async (context, body) => {
    await connectDiscord(context, body);
    return Response.json({ message: "Discord connected." });
  },
  { adminOnly: true },
);
